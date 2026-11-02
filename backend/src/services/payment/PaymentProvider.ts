import { RunRecord } from '../../repositories/RunRepository.js';

export interface PaymentOrderResult {
  orderId: string;
  approvalUrl?: string;
  amountPaise: number;
  currency: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  provider: 'mock' | 'paypal_sandbox';
  chargedAmount?: string;
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
  chargedAmount?: string;
}

export type PaymentState = 'PENDING' | 'APPROVED' | 'CAPTURED' | 'FAILED' | 'CANCELLED';

export interface PaymentStatusResult {
  orderId: string;
  status: 'CREATED' | 'APPROVED' | 'COMPLETED' | 'VOIDED' | 'PAYER_ACTION_REQUIRED';
  approvalUrl?: string;
  capture?: PaymentCaptureResult;
  chargedAmount?: string;
  currency?: string;
}

export interface IPaymentProvider {
  readonly providerId: 'mock' | 'paypal_sandbox';
  createOrder(run: RunRecord, returnUrl?: string, cancelUrl?: string): Promise<PaymentOrderResult>;
  captureOrder(orderId: string, run?: RunRecord): Promise<PaymentCaptureResult>;
  getOrderStatus(orderId: string, run?: RunRecord): Promise<PaymentStatusResult>;
  verifyWebhookSignature?(headers: Record<string, string>, event: Record<string, unknown>): Promise<boolean>;
}
