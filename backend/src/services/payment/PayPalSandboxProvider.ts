import { IPaymentProvider, PaymentOrderResult, PaymentCaptureResult } from './PaymentProvider.js';
import { RunRecord } from '../../repositories/RunRepository.js';
import { config } from '../../config.js';
import { paiseToUsd } from '@shared/services/currency';
import { AppError } from '../../middleware/errorHandler.js';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix ms
}

interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

interface PayPalOrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links?: PayPalLink[];
  payer?: {
    email_address?: string;
    payer_id?: string;
  };
  purchase_units?: Array<{
    reference_id?: string;
    amount?: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: {
          currency_code: string;
          value: string;
        };
        create_time?: string;
        update_time?: string;
      }>;
    };
  }>;
}

interface PayPalErrorDetail {
  field?: string;
  value?: string;
  issue?: string;
  description?: string;
}

interface PayPalErrorResponse {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: PayPalErrorDetail[];
  information_link?: string;
}

/**
 * PayPalSandboxProvider
 * Production-grade integration with PayPal REST APIs (v1 OAuth2 & v2 Orders/Capture).
 * Operates in USD against PayPal Sandbox with in-memory token caching and currency conversion.
 */
export class PayPalSandboxProvider implements IPaymentProvider {
  readonly providerId = 'paypal_sandbox' as const;
  private tokenCache: CachedToken | null = null;

  constructor(
    private clientId: string = config.PAYPAL_CLIENT_ID || '',
    private clientSecret: string = config.PAYPAL_CLIENT_SECRET || '',
    private baseUrl: string = config.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com',
    private usdRate: number = config.PAYPAL_USD_RATE || 85
  ) {
    if (!this.clientId || !this.clientSecret) {
      console.warn('[PayPalSandboxProvider] PayPal credentials are not configured.');
    }
  }

  /**
   * For testing or reset: clears token cache
   */
  clearTokenCache(): void {
    this.tokenCache = null;
  }

  /**
   * Retrieves or reuses an OAuth 2.0 access token via client credentials grant.
   * Caches token until (expires_in - 60s). Never logs tokens or credentials.
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new AppError(
        'PAYPAL_CONFIG_MISSING',
        'PayPal Sandbox client credentials are not configured',
        500
      );
    }

    const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
    const tokenUrl = `${this.baseUrl.replace(/\/+$/, '')}/v1/oauth2/token`;

    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.code === 23) {
        throw new AppError('PAYPAL_GATEWAY_TIMEOUT', 'PayPal OAuth request timed out (10s)', 504);
      }
      throw new AppError('PAYPAL_NETWORK_ERROR', `PayPal OAuth network error: ${err.message}`, 502);
    }

    if (res.status === 401) {
      this.clearTokenCache();
      throw new AppError(
        'PAYPAL_AUTH_FAILED',
        'PayPal authentication failed: Invalid Client ID or Secret',
        401
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.clearTokenCache();
      throw new AppError(
        'PAYPAL_AUTH_FAILED',
        `PayPal OAuth error (${res.status}): ${errText || res.statusText}`,
        502
      );
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    if (!data.access_token) {
      throw new AppError('PAYPAL_AUTH_FAILED', 'Malformed response from PayPal OAuth endpoint', 502);
    }

    const ttlMs = Math.max(0, (data.expires_in - 60) * 1000);
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + ttlMs,
    };

    return data.access_token;
  }

  /**
   * Creates a PayPal v2 checkout order in USD.
   */
  async createOrder(run: RunRecord): Promise<PaymentOrderResult> {
    const token = await this.getAccessToken();
    const conversion = paiseToUsd(run.grandTotalPaise, this.usdRate);

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: run.id,
          description: `ShopPilot AI Restock Run ${run.id}`,
          amount: {
            currency_code: 'USD',
            value: conversion.usd,
          },
        },
      ],
    };

    const orderUrl = `${this.baseUrl.replace(/\/+$/, '')}/v2/checkout/orders`;

    let res: Response;
    try {
      res = await fetch(orderUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': run.id,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.code === 23) {
        throw new AppError('PAYPAL_GATEWAY_TIMEOUT', 'PayPal create order timed out (10s)', 504);
      }
      throw new AppError('PAYPAL_NETWORK_ERROR', `PayPal create order error: ${err.message}`, 502);
    }

    if (!res.ok) {
      const errorJson = (await res.json().catch(() => ({}))) as PayPalErrorResponse;
      if (errorJson.debug_id) {
        console.info(`[PayPalSandboxProvider] createOrder error: debug_id=${errorJson.debug_id} name=${errorJson.name || res.status}`);
      }
      const detailMsg = errorJson.details?.map(d => d.description || d.issue).filter(Boolean).join('; ');
      throw new AppError(
        errorJson.name || 'PAYPAL_ORDER_FAILED',
        detailMsg || errorJson.message || `PayPal order creation failed (${res.status})`,
        res.status >= 400 && res.status < 500 ? res.status : 502
      );
    }

    const data = (await res.json()) as PayPalOrderResponse;
    const approvalLink = data.links?.find(
      l => l.rel === 'payer-action' || l.rel === 'approve'
    );

    return {
      orderId: data.id,
      approvalUrl: approvalLink?.href,
      amountPaise: run.grandTotalPaise,
      currency: 'USD',
      status: data.status || 'CREATED',
      provider: 'paypal_sandbox',
      usdAmount: conversion.usd,
      usdRate: conversion.rate,
      inrPaise: run.grandTotalPaise,
    };
  }

  /**
   * Captures an authorized/approved order.
   * Handles ORDER_ALREADY_CAPTURED gracefully by looking up the order status.
   */
  async captureOrder(orderId: string): Promise<PaymentCaptureResult> {
    const token = await this.getAccessToken();
    const captureUrl = `${this.baseUrl.replace(/\/+$/, '')}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`;

    let res: Response;
    try {
      res = await fetch(captureUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `capture-${orderId}`,
        },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.code === 23) {
        throw new AppError('PAYPAL_GATEWAY_TIMEOUT', 'PayPal capture order timed out (10s)', 504);
      }
      throw new AppError('PAYPAL_NETWORK_ERROR', `PayPal capture order error: ${err.message}`, 502);
    }

    if (!res.ok) {
      const errorJson = (await res.json().catch(() => ({}))) as PayPalErrorResponse;
      if (errorJson.debug_id) {
        console.info(`[PayPalSandboxProvider] captureOrder error: debug_id=${errorJson.debug_id} name=${errorJson.name || res.status}`);
      }

      // Special case: ORDER_ALREADY_CAPTURED recovery
      const isAlreadyCaptured =
        res.status === 422 &&
        (errorJson.details?.some(d => d.issue === 'ORDER_ALREADY_CAPTURED') ||
          errorJson.name === 'ORDER_ALREADY_CAPTURED' ||
          errorJson.message?.includes('ORDER_ALREADY_CAPTURED'));

      if (isAlreadyCaptured) {
        return this.recoverCompletedOrder(orderId, token);
      }

      const detailMsg = errorJson.details?.map(d => d.description || d.issue).filter(Boolean).join('; ');
      throw new AppError(
        errorJson.name || 'PAYPAL_CAPTURE_FAILED',
        detailMsg || errorJson.message || `PayPal capture failed (${res.status})`,
        res.status >= 400 && res.status < 500 ? res.status : 502
      );
    }

    const data = (await res.json()) as PayPalOrderResponse;
    if (data.status !== 'COMPLETED') {
      throw new AppError(
        'PAYPAL_CAPTURE_FAILED',
        `PayPal capture returned non-completed status "${data.status}"`,
        400
      );
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || `CAP-${orderId}`;
    const payerEmail = data.payer?.email_address;
    const usdAmount = capture?.amount?.value || data.purchase_units?.[0]?.amount?.value || '0.00';
    const timestamp = capture?.create_time || capture?.update_time || new Date().toISOString();

    return {
      orderId,
      captureId,
      status: 'COMPLETED',
      amountPaise: 0,
      currency: 'USD',
      provider: 'paypal_sandbox',
      payerEmail,
      usdAmount,
      usdRate: this.usdRate,
      capturedAt: timestamp,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Recovers details of an already-captured order via GET /v2/checkout/orders/{orderId}.
   */
  private async recoverCompletedOrder(orderId: string, token: string): Promise<PaymentCaptureResult> {
    const getUrl = `${this.baseUrl.replace(/\/+$/, '')}/v2/checkout/orders/${encodeURIComponent(orderId)}`;

    let res: Response;
    try {
      res = await fetch(getUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err: any) {
      throw new AppError('PAYPAL_NETWORK_ERROR', `PayPal get order error: ${err.message}`, 502);
    }

    if (!res.ok) {
      throw new AppError(
        'PAYPAL_CAPTURE_FAILED',
        `Order was already captured, but unable to verify status (${res.status})`,
        res.status >= 400 && res.status < 500 ? res.status : 502
      );
    }

    const data = (await res.json()) as PayPalOrderResponse;
    if (data.status !== 'COMPLETED') {
      throw new AppError(
        'PAYPAL_CAPTURE_FAILED',
        `Order was already captured but status is not COMPLETED (found "${data.status}")`,
        400
      );
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || `CAP-${orderId}`;
    const payerEmail = data.payer?.email_address;
    const usdAmount = capture?.amount?.value || data.purchase_units?.[0]?.amount?.value || '0.00';
    const timestamp = capture?.create_time || capture?.update_time || new Date().toISOString();

    return {
      orderId,
      captureId,
      status: 'COMPLETED',
      amountPaise: 0,
      currency: 'USD',
      provider: 'paypal_sandbox',
      payerEmail,
      usdAmount,
      usdRate: this.usdRate,
      capturedAt: timestamp,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}
