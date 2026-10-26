import { RunRecord } from '../../repositories/RunRepository.js';

export interface PaymentOrderResult {
  orderId: string;
  approvalUrl?: string;
  amountPaise: number;
  currency: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  provider: 'mock' | 'paypal_sandbox';
}

export interface PaymentCaptureResult {
  orderId: string;
  captureId: string;
  status: 'COMPLETED' | 'FAILED';
  amountPaise: number;
  currency: string;
  provider: 'mock' | 'paypal_sandbox';
  payerEmail?: string;
  rawResponse?: Record<string, unknown>;
}

export interface IPaymentProvider {
  readonly providerId: 'mock' | 'paypal_sandbox';
  createOrder(run: RunRecord): Promise<PaymentOrderResult>;
  captureOrder(orderId: string): Promise<PaymentCaptureResult>;
}
