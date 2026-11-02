import { IPaymentProvider, PaymentOrderResult, PaymentCaptureResult } from './PaymentProvider.js';
import { RunRecord } from '../../repositories/RunRepository.js';

import { paiseToUsd } from '@shared/services/currency';
import { config } from '../../config.js';

export class MockPaymentProvider implements IPaymentProvider {
  readonly providerId = 'mock' as const;

  async createOrder(run: RunRecord): Promise<PaymentOrderResult> {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `PAYPAL-MOCK-${randomSuffix}`;
    const conversion = paiseToUsd(run.grandTotalPaise, config.PAYPAL_USD_RATE);

    return {
      orderId,
      amountPaise: run.grandTotalPaise,
      currency: 'INR',
      status: 'CREATED',
      provider: 'mock',
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
      usdAmount: conversion.usd,
      usdRate: conversion.rate,
      inrPaise: run.grandTotalPaise,
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
      usdAmount: '1.00',
      usdRate: config.PAYPAL_USD_RATE,
      capturedAt: new Date().toISOString(),
    };
  }
}
