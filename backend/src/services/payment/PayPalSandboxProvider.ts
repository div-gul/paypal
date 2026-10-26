import { IPaymentProvider, PaymentOrderResult, PaymentCaptureResult } from './PaymentProvider.js';
import { RunRecord } from '../../repositories/RunRepository.js';
import { config } from '../../config.js';

/**
 * PayPalSandboxProvider
 * Wiring for real PayPal Sandbox API integration.
 * NOTE: The actual PayPal SDK / v2/checkout/orders HTTP calls will be implemented
 * by teammate. The interface and wiring are fully defined here.
 */
export class PayPalSandboxProvider implements IPaymentProvider {
  readonly providerId = 'paypal_sandbox' as const;

  constructor(
    private clientId: string | undefined = config.PAYPAL_CLIENT_ID,
    private clientSecret: string | undefined = config.PAYPAL_CLIENT_SECRET
  ) {
    if (!this.clientId || !this.clientSecret) {
      console.warn('[PayPalSandboxProvider] PayPal credentials are not configured. Running in sandbox stub mode.');
    }
  }

  async createOrder(run: RunRecord): Promise<PaymentOrderResult> {
    // =========================================================================
    // TODO: Teammate implementing real PayPal Sandbox OAuth & Orders API call:
    // 1. Obtain OAuth 2.0 access token via POST https://api-m.sandbox.paypal.com/v1/oauth2/token
    //    using Basic auth (clientId:clientSecret) with grant_type=client_credentials.
    // 2. Call POST https://api-m.sandbox.paypal.com/v2/checkout/orders:
    //    {
    //      intent: 'CAPTURE',
    //      purchase_units: [{
    //        reference_id: run.id,
    //        amount: {
    //          currency_code: 'USD', // or INR if supported by sandbox merchant
    //          value: (run.grandTotalPaise / 100).toFixed(2)
    //        }
    //      }]
    //    }
    // 3. Extract order ID and approval link from response.links (rel: 'approve').
    // =========================================================================

    const simulatedOrderId = `PAYPAL-SBX-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      orderId: simulatedOrderId,
      amountPaise: run.grandTotalPaise,
      currency: 'INR',
      status: 'CREATED',
      provider: 'paypal_sandbox',
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${simulatedOrderId}`,
    };
  }

  async captureOrder(orderId: string): Promise<PaymentCaptureResult> {
    // =========================================================================
    // TODO: Teammate implementing real PayPal Sandbox capture API call:
    // 1. Obtain OAuth 2.0 bearer token.
    // 2. Call POST https://api-m.sandbox.paypal.com/v2/checkout/orders/{orderId}/capture
    //    with headers { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    // 3. Verify capture status === 'COMPLETED'.
    // 4. Return captured details.
    // =========================================================================

    const simulatedCaptureId = `CAP-SBX-${Date.now()}`;

    return {
      orderId,
      captureId: simulatedCaptureId,
      status: 'COMPLETED',
      amountPaise: 0,
      currency: 'INR',
      provider: 'paypal_sandbox',
      payerEmail: 'sandbox-buyer@shoppilot.local',
    };
  }
}
