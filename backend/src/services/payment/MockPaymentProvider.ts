import { IPaymentProvider, PaymentOrderResult, PaymentCaptureResult } from './PaymentProvider.js';
import { RunRecord } from '../../repositories/RunRepository.js';

export class MockPaymentProvider implements IPaymentProvider {
  readonly providerId = 'mock' as const;

  async createOrder(run: RunRecord): Promise<PaymentOrderResult> {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `PAYPAL-MOCK-${randomSuffix}`;

    return {
      orderId,
      amountPaise: run.grandTotalPaise,
      currency: 'INR',
      status: 'CREATED',
      provider: 'mock',
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
    };
  }

  async captureOrder(orderId: string): Promise<PaymentCaptureResult> {
    const captureId = `CAP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      orderId,
      captureId,
      status: 'COMPLETED',
      amountPaise: 0, // Filled in by caller matching run
      currency: 'INR',
      provider: 'mock',
      payerEmail: 'demo-buyer@shoppilot.local',
    };
  }
}
