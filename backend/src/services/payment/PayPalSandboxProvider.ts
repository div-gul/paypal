import { createHash } from 'node:crypto';
import { AppError } from '../../middleware/errorHandler.js';
import { config } from '../../config.js';
import type { AppConfig } from '../../config.js';
import { RunRecord } from '../../repositories/RunRepository.js';
import { inrPaiseToUsdAmount, usdAmountToInrPaise } from '@shared/services/currency';
import {
  IPaymentProvider,
  PaymentCaptureResult,
  PaymentOrderResult,
  PaymentStatusResult,
} from './PaymentProvider.js';

interface PayPalCapture {
  id?: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
  seller_receivable_breakdown?: Record<string, unknown>;
}

interface PayPalOrder {
  id?: string;
  status?: string;
  links?: Array<{ rel?: string; href?: string }>;
  payer?: { email_address?: string };
  purchase_units?: Array<{
    payments?: { captures?: PayPalCapture[] };
  }>;
}

export class PayPalSandboxProvider implements IPaymentProvider {
  constructor(
    private readonly paypalConfig: Pick<AppConfig, 'PAYPAL_MODE' | 'PAYPAL_BASE_URL' | 'PAYPAL_CURRENCY' | 'PAYPAL_INR_PER_USD' | 'PAYPAL_CLIENT_ID' | 'PAYPAL_CLIENT_SECRET' | 'PAYPAL_WEBHOOK_ID'> = config,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get providerId(): 'paypal_sandbox' | 'paypal_live' {
    return this.paypalConfig.PAYPAL_MODE === 'live' ? 'paypal_live' : 'paypal_sandbox';
  }
  private accessToken?: string;
  private tokenExpiresAt = 0;

  private get baseUrl(): string {
    return this.paypalConfig.PAYPAL_BASE_URL.replace(/\/$/, '');
  }

  private get chargeCurrency(): 'INR' | 'USD' {
    return this.paypalConfig.PAYPAL_CURRENCY;
  }

  private chargeAmount(run: RunRecord): string {
    if (this.chargeCurrency === 'INR') {
      return (run.grandTotalPaise / 100).toFixed(2);
    }
    const inrPerUsd = this.paypalConfig.PAYPAL_INR_PER_USD;
    if (!inrPerUsd) {
      throw new AppError(
        'PAYPAL_CURRENCY_CONFIGURATION_REQUIRED',
        'PayPal does not list INR as a supported payment currency. Set PAYPAL_CURRENCY=USD and an explicit PAYPAL_INR_PER_USD rate to continue.',
        503
      );
    }
    return inrPaiseToUsdAmount(run.grandTotalPaise, inrPerUsd);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 15_000) return this.accessToken;
    if (!this.paypalConfig.PAYPAL_CLIENT_ID || !this.paypalConfig.PAYPAL_CLIENT_SECRET) {
      throw new AppError('PAYPAL_NOT_CONFIGURED', 'PayPal credentials are not configured.', 503);
    }

    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.paypalConfig.PAYPAL_CLIENT_ID}:${this.paypalConfig.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError('PAYPAL_UNAVAILABLE', 'Could not connect to PayPal authentication.', 502);
    }

    const data = await this.readJson(response);
    if (!response.ok || typeof data.access_token !== 'string') {
      throw this.payPalError(response.status, data, 'PayPal authentication failed.');
    }
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (Number(data.expires_in) || 300) * 1000;
    return this.accessToken;
  }

  private async request(path: string, init: RequestInit = {}): Promise<{ response: Response; data: any }> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: init.signal || AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AppError('PAYPAL_UNAVAILABLE', 'Could not connect to PayPal.', 502);
    }
    return { response, data: await this.readJson(response) };
  }

  private async readJson(response: Response): Promise<any> {
    const raw = await response.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new AppError('PAYPAL_INVALID_RESPONSE', 'PayPal returned an unreadable response.', 502);
    }
  }

  private payPalError(status: number, data: any, fallback: string): AppError {
    const detail = Array.isArray(data?.details) && data.details.length > 0 ? data.details[0] : undefined;
    const issue = detail?.issue ? String(detail.issue) : '';
    const detailDescription = detail?.description ? String(detail.description) : '';
    const name = String(issue || data?.name || 'PAYPAL_API_ERROR');
    const errorText = `${name} ${issue} ${detailDescription} ${data?.name || ''} ${data?.message || ''}`;
    if (/unsupported_payee_currency|(?:owner|merchant|payee|seller).{0,80}(?:does not|doesn't|cannot|can't).{0,40}accept.{0,40}currenc|currenc.{0,80}(?:not enabled|not accepted|not configured to accept)/i.test(errorText)) {
      return new AppError(
        'PAYPAL_MERCHANT_CURRENCY_NOT_ACCEPTED',
        `The PayPal merchant account is refusing ${this.chargeCurrency}. Configure the merchant account to accept that currency. The ShopPilot INR total was not changed and no payment was captured.`,
        422
      );
    }
    if (/currency_not_supported|unsupported_currency/i.test(errorText)) {
      return new AppError(
        'PAYPAL_CURRENCY_UNSUPPORTED',
        `PayPal does not support the configured ${this.chargeCurrency} currency for this order. Use a supported currency and an explicit INR conversion rate; the ShopPilot INR total was not changed.`,
        422
      );
    }
    return new AppError('PAYPAL_API_ERROR', fallback, status >= 400 && status < 600 ? status : 502);
  }

  private captureFromOrder(order: PayPalOrder, run: RunRecord): PaymentCaptureResult | undefined {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture?.id || capture.status !== 'COMPLETED' || !capture.amount?.value || !capture.amount.currency_code) {
      return undefined;
    }
    const expectedCurrency = run.paymentCurrency || this.chargeCurrency;
    const expectedAmount = run.paymentAmount || this.chargeAmount(run);
    if (order.id !== run.orderId || capture.amount.currency_code !== expectedCurrency || capture.amount.value !== expectedAmount) {
      throw new AppError('PAYPAL_AMOUNT_MISMATCH', 'PayPal capture amount or currency does not match the approved ShopPilot order.', 409);
    }
    if (expectedCurrency === 'USD') {
      const roundTripInrPaise = usdAmountToInrPaise(capture.amount.value, config.PAYPAL_INR_PER_USD!);
      const maximumRoundingDifference = Math.ceil(config.PAYPAL_INR_PER_USD! / 2);
      if (Math.abs(roundTripInrPaise - run.grandTotalPaise) > maximumRoundingDifference) {
        throw new AppError('PAYPAL_AMOUNT_MISMATCH', 'The captured USD amount does not convert back to the approved ShopPilot INR total.', 409);
      }
    }
    return {
      orderId: order.id || '',
      captureId: capture.id,
      status: 'COMPLETED',
      amountPaise: run.grandTotalPaise,
      currency: capture.amount.currency_code,
      chargedAmount: capture.amount.value,
      provider: this.providerId,
      payerEmail: order.payer?.email_address,
      rawResponse: capture.seller_receivable_breakdown,
    };
  }

  async createOrder(run: RunRecord, returnUrl?: string, cancelUrl?: string): Promise<PaymentOrderResult> {
    const amount = this.chargeAmount(run);
    const requestId = createHash('sha256').update(`${run.id}:${run.updatedAt}`).digest('hex').slice(0, 32);
    const { response, data } = await this.request('/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': requestId },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: run.id,
          custom_id: run.id,
          description: `ShopPilot grocery order ${run.id}`,
          amount: { currency_code: this.chargeCurrency, value: amount },
        }],
        application_context: {
          brand_name: 'ShopPilot',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });
    if (!response.ok) throw this.payPalError(response.status, data, 'PayPal could not create the checkout order.');
    const approvalUrl = data.links?.find((link: any) => link.rel === 'approve')?.href;
    if (typeof data.id !== 'string' || typeof approvalUrl !== 'string') {
      throw new AppError('PAYPAL_INVALID_RESPONSE', 'PayPal did not return an order ID and buyer approval URL.', 502);
    }
    return {
      orderId: data.id,
      approvalUrl,
      amountPaise: run.grandTotalPaise,
      currency: this.chargeCurrency,
      chargedAmount: amount,
      status: data.status || 'CREATED',
      provider: this.providerId,
    };
  }

  async captureOrder(orderId: string, run?: RunRecord): Promise<PaymentCaptureResult> {
    if (!run) throw new AppError('RUN_NOT_FOUND', 'The ShopPilot run for this PayPal order was not found.', 404);
    const { response, data } = await this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': createHash('sha256').update(`capture:${orderId}`).digest('hex').slice(0, 32) },
      body: '{}',
    });
    if (!response.ok) throw this.payPalError(response.status, data, 'PayPal could not capture this order.');
    const capture = this.captureFromOrder(data, run);
    if (!capture) throw new AppError('PAYMENT_CAPTURE_FAILED', `PayPal order status is ${data.status || 'unknown'}; payment was not captured.`, 402);
    return capture;
  }

  async getOrderStatus(orderId: string, run?: RunRecord): Promise<PaymentStatusResult> {
    const { response, data } = await this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
    if (!response.ok) throw this.payPalError(response.status, data, 'PayPal could not retrieve this order.');
    const capture = run ? this.captureFromOrder(data, run) : undefined;
    return {
      orderId: data.id || orderId,
      status: data.status,
      approvalUrl: data.links?.find((link: any) => link.rel === 'approve')?.href,
      capture,
      chargedAmount: capture?.chargedAmount,
      currency: capture?.currency || this.chargeCurrency,
    };
  }

  async verifyWebhookSignature(headers: Record<string, string>, event: Record<string, unknown>): Promise<boolean> {
    const requiredHeaders = [
      headers['paypal-auth-algo'],
      headers['paypal-cert-url'],
      headers['paypal-transmission-id'],
      headers['paypal-transmission-sig'],
      headers['paypal-transmission-time'],
    ];
    if (!this.paypalConfig.PAYPAL_WEBHOOK_ID || requiredHeaders.some(value => !value?.trim())) return false;
    const { response, data } = await this.request('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.paypalConfig.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
    });
    return response.ok && data.verification_status === 'SUCCESS';
  }
}
