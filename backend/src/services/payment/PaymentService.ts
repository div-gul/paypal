import Database from 'better-sqlite3';
import { IPaymentProvider, PaymentCaptureResult, PaymentOrderResult } from './PaymentProvider.js';
import { MockPaymentProvider } from './MockPaymentProvider.js';
import { PayPalSandboxProvider } from './PayPalSandboxProvider.js';
import { RunRepository, RunRecord } from '../../repositories/RunRepository.js';
import { RunItemRepository } from '../../repositories/RunItemRepository.js';
import { ReceiptRepository } from '../../repositories/ReceiptRepository.js';
import { PantryRepository } from '../../repositories/PantryRepository.js';
import { PolicyService } from '../PolicyService.js';
import { SimClockRepository } from '../../repositories/SimClockRepository.js';
import { AuditLogRepository } from '../../repositories/AuditLogRepository.js';
import { evaluatePolicy } from '@shared/policy';
import { AppError } from '../../middleware/errorHandler.js';
import { formatPaise } from '@shared/services/currency';
import { config } from '../../config.js';

export class PaymentService {
  private provider: IPaymentProvider;
  private runRepo: RunRepository;
  private runItemRepo: RunItemRepository;
  private receiptRepo: ReceiptRepository;
  private pantryRepo: PantryRepository;
  private clockRepo: SimClockRepository;
  private auditRepo: AuditLogRepository;

  constructor(private db: Database.Database, customProvider?: IPaymentProvider) {
    this.provider = customProvider || (config.PAYPAL_MODE === 'sandbox'
      ? new PayPalSandboxProvider()
      : new MockPaymentProvider());
    this.runRepo = new RunRepository(db);
    this.runItemRepo = new RunItemRepository(db);
    this.receiptRepo = new ReceiptRepository(db);
    this.pantryRepo = new PantryRepository(db);
    this.clockRepo = new SimClockRepository(db);
    this.auditRepo = new AuditLogRepository(db);
  }

  getProviderId(): string {
    return this.provider.providerId;
  }

  async createCheckoutOrder(userId: string, runId: string): Promise<PaymentOrderResult & { run: RunRecord }> {
    let run = this.runRepo.getById(userId, runId);
    if (!run) throw new AppError('RUN_NOT_FOUND', `Run "${runId}" not found`, 404);

    // A checkout must have purchasable lines and a positive total. This also
    // catches old or inconsistent runs before returning a cached PayPal order.
    const runItems = this.runItemRepo.getByRunId(userId, runId);
    if (runItems.length === 0 || run.grandTotalPaise <= 0) {
      throw new AppError('EMPTY_ORDER', 'This restock order has no items to purchase. Generate a new restock plan before checkout.', 400);
    }
    const strategyItemCount = run.selectedStrategyDetails?.storeBaskets
      .reduce((count, basket) => count + basket.items.length, 0) ?? 0;
    if (strategyItemCount !== runItems.length) {
      throw new AppError('ORDER_DATA_MISMATCH', 'This restock plan is out of sync with its saved items. Generate a new restock plan before checkout.', 409);
    }

    if (run.paymentState === 'CAPTURED' || run.status === 'paid') {
      throw new AppError('ORDER_ALREADY_PAID', 'This ShopPilot order has already been paid.', 409);
    }
    if (run.orderId && ['PENDING', 'APPROVED'].includes(run.paymentState)) {
      return {
        orderId: run.orderId,
        approvalUrl: run.paypalApprovalUrl || undefined,
        amountPaise: run.grandTotalPaise,
        currency: run.paymentCurrency || 'INR',
        chargedAmount: run.paymentAmount || undefined,
        status: run.paymentState === 'APPROVED' ? 'APPROVED' : 'CREATED',
        provider: this.provider.providerId,
        run,
      };
    }

    const policy = new PolicyService(this.db).getPolicy(userId);
    const pantryItems = this.pantryRepo.getAllByUserId(userId);
    const clock = this.clockRepo.getByUserId(userId);
    if (!policy || !clock) throw new AppError('CONFIG_ERROR', 'Policy or clock not initialized', 500);
    if (!run.selectedStrategyDetails) throw new AppError('INVALID_RUN', 'Run is missing itemized strategy details', 400);

    const policyEval = evaluatePolicy({ strategy: run.selectedStrategyDetails, policy, pantryItems, isOffCycleEmergency: false });
    if (policyEval.decision === 'blocked') {
      this.runRepo.updateStatus(userId, runId, 'blocked');
      throw new AppError('POLICY_VIOLATION_BLOCKED', `Run is blocked by policy: ${policyEval.reasons.join('; ')}`, 403);
    }
    const previouslyApprovedPayment = ['CANCELLED', 'FAILED'].includes(run.paymentState) && Boolean(run.orderId);
    if (!previouslyApprovedPayment && !['approved', 'auto_approved'].includes(run.status)) {
      throw new AppError('APPROVAL_REQUIRED', `Run status is "${run.status}". Approve the ShopPilot order before checkout.`, 403);
    }

    const base = config.APP_BASE_URL.replace(/\/$/, '');
    const returnUrl = `${base}/?paypal=return&runId=${encodeURIComponent(runId)}`;
    const cancelUrl = `${base}/?paypal=cancel&runId=${encodeURIComponent(runId)}`;
    const orderResult = await this.provider.createOrder(run, returnUrl, cancelUrl);
    run = this.runRepo.setOrderId(userId, runId, {
      orderId: orderResult.orderId,
      approvalUrl: orderResult.approvalUrl,
      amount: orderResult.chargedAmount || (orderResult.amountPaise / 100).toFixed(2),
      currency: orderResult.currency,
    });
    return { ...orderResult, run };
  }

  async captureCheckoutOrder(userId: string, orderId: string, clientRunId?: string) {
    const existingReceipt = this.receiptRepo.findByOrderId(userId, orderId);
    if (existingReceipt) {
      const run = this.runRepo.getById(userId, existingReceipt.runId);
      return { success: true, receipt: existingReceipt, run: run!, alreadyCaptured: true };
    }

    const run = this.runRepo.findByOrderId(orderId);
    if (!run) throw new AppError('ORDER_NOT_FOUND', `No ShopPilot run found for order "${orderId}"`, 404);
    if (run.userId !== userId) throw new AppError('UNAUTHORIZED', 'This PayPal order belongs to another user.', 403);
    if (clientRunId && run.id !== clientRunId) throw new AppError('RUN_MISMATCH', 'The PayPal order does not match this ShopPilot run.', 400);
    if (run.paymentState === 'CANCELLED' || run.paymentState === 'FAILED') {
      throw new AppError('PAYMENT_NOT_ACTIVE', `This payment is ${run.paymentState.toLowerCase()}; create a new checkout session to retry.`, 409);
    }
    if (!['payment_pending', 'approved', 'auto_approved'].includes(run.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', `Run ${run.id} in status "${run.status}" cannot be captured.`, 400);
    }

    let captureResult: PaymentCaptureResult;
    try {
      captureResult = await this.provider.captureOrder(orderId, run);
    } catch (error) {
      this.runRepo.setPaymentState(userId, run.id, 'FAILED');
      this.runRepo.updateStatus(userId, run.id, 'failed');
      throw error;
    }
    if (captureResult.status !== 'COMPLETED') {
      this.runRepo.setPaymentState(userId, run.id, 'FAILED');
      this.runRepo.updateStatus(userId, run.id, 'failed');
      throw new AppError('PAYMENT_CAPTURE_FAILED', `PayPal did not confirm capture for order ${orderId}.`, 402);
    }
    return this.finalizeCapture(userId, run, captureResult);
  }

  async getCheckoutStatus(userId: string, runId: string) {
    const run = this.runRepo.getById(userId, runId);
    if (!run) throw new AppError('RUN_NOT_FOUND', `Run "${runId}" not found`, 404);
    const receipt = run.orderId ? this.receiptRepo.findByOrderId(userId, run.orderId) : null;
    if (receipt || run.paymentState === 'CAPTURED') {
      return { runId, orderId: run.orderId, paymentState: 'CAPTURED' as const, approvalUrl: run.paypalApprovalUrl, receipt };
    }
    if (!run.orderId) {
      return { runId, orderId: null, paymentState: run.paymentState, approvalUrl: null, receipt: null };
    }

    if (this.provider.providerId === 'mock') {
      return { runId, orderId: run.orderId, paymentState: run.paymentState, approvalUrl: run.paypalApprovalUrl, receipt: null };
    }

    const paypal = await this.provider.getOrderStatus(run.orderId, run);
    if (paypal.status === 'APPROVED') {
      this.runRepo.setPaymentState(userId, run.id, 'APPROVED');
      const captured = await this.captureCheckoutOrder(userId, run.orderId, run.id);
      return { runId, orderId: run.orderId, paymentState: 'CAPTURED' as const, approvalUrl: run.paypalApprovalUrl, receipt: captured.receipt };
    }
    if (paypal.status === 'COMPLETED' && paypal.capture) {
      const captured = await this.finalizeCapture(userId, run, paypal.capture);
      return { runId, orderId: run.orderId, paymentState: 'CAPTURED' as const, approvalUrl: run.paypalApprovalUrl, receipt: captured.receipt };
    }
    if (paypal.status === 'VOIDED') this.runRepo.setPaymentState(userId, run.id, 'CANCELLED');
    return {
      runId,
      orderId: run.orderId,
      paymentState: paypal.status === 'VOIDED' ? 'CANCELLED' as const : run.paymentState,
      approvalUrl: run.paypalApprovalUrl || paypal.approvalUrl,
      receipt: null,
      chargedAmount: run.paymentAmount,
      currency: run.paymentCurrency,
    };
  }

  async cancelCheckoutOrder(userId: string, runId: string, orderId?: string) {
    const run = this.runRepo.getById(userId, runId);
    if (!run) throw new AppError('RUN_NOT_FOUND', `Run "${runId}" not found`, 404);
    if (!run.orderId || (orderId && orderId !== run.orderId)) {
      throw new AppError('ORDER_NOT_FOUND', 'The PayPal order does not match the ShopPilot run.', 404);
    }
    if (run.paymentState === 'CAPTURED' || this.receiptRepo.findByOrderId(userId, run.orderId)) {
      return this.getCheckoutStatus(userId, runId);
    }
    if (this.provider.providerId === 'paypal_sandbox') {
      const paypal = await this.provider.getOrderStatus(run.orderId, run);
      if (paypal.status === 'COMPLETED' && paypal.capture) {
        await this.finalizeCapture(userId, run, paypal.capture);
        return this.getCheckoutStatus(userId, runId);
      }
    }
    const updated = this.runRepo.setPaymentState(userId, runId, 'CANCELLED');
    return { runId, orderId: run.orderId, paymentState: updated.paymentState, approvalUrl: run.paypalApprovalUrl, receipt: null };
  }

  async syncOrderFromWebhook(orderId: string) {
    const run = this.runRepo.findByOrderId(orderId);
    if (!run) return null;
    return this.getCheckoutStatus(run.userId, run.id);
  }

  private finalizeCapture(userId: string, run: RunRecord, capture: PaymentCaptureResult) {
    const captureTx = this.db.transaction(() => {
      const existing = this.receiptRepo.findByOrderId(userId, capture.orderId);
      if (existing) {
        const currentRun = this.runRepo.getById(userId, existing.runId)!;
        return { receipt: existing, updatedRun: currentRun, alreadyCaptured: true };
      }

      const clock = this.clockRepo.getByUserId(userId);
      const simDate = clock?.simulatedDate || new Date().toISOString();
      const lineItems = this.runItemRepo.getByRunId(userId, run.id);
      const pantryItems = this.pantryRepo.getAllByUserId(userId);
      this.runRepo.updateStatus(userId, run.id, 'paid');
      const capturedRun = this.runRepo.setPaymentState(userId, run.id, 'CAPTURED', {
        captureId: capture.captureId,
        paymentDetails: capture.rawResponse ? JSON.stringify(capture.rawResponse) : undefined,
      });
      const receipt = this.receiptRepo.create(userId, {
        id: `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        runId: run.id,
        orderId: capture.orderId,
        amountPaise: run.grandTotalPaise,
        currency: 'INR',
        paymentProvider: this.provider.providerId,
        itemsJson: JSON.stringify(lineItems),
        breakdownJson: JSON.stringify({
          productSubtotalPaise: run.productSubtotalPaise,
          deliveryFeePaise: run.deliveryFeePaise,
          handlingFeePaise: run.handlingFeePaise,
          taxPaise: run.taxPaise,
          grandTotalPaise: run.grandTotalPaise,
        }),
        status: 'settled',
        captureId: capture.captureId,
        chargedAmount: capture.chargedAmount || (run.grandTotalPaise / 100).toFixed(2),
        chargedCurrency: capture.currency,
        transactionJson: capture.rawResponse ? JSON.stringify(capture.rawResponse) : null,
      });

      const updatedPantry = pantryItems.map(item => {
        const purchased = lineItems.find(line => line.pantryItemId === item.id);
        return purchased
          ? { ...item, currentQuantity: Math.max(item.targetStock, Math.round((item.currentQuantity + purchased.quantity) * 100) / 100), lastRestockedDate: simDate, stockoutDaysCount: 0 }
          : item;
      });
      this.pantryRepo.batchSave(userId, updatedPantry);
      this.auditRepo.create(userId, {
        id: `audit-${Date.now()}-checkout-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: simDate,
        type: 'checkout_completed',
        title: `Payment Captured (${capture.orderId})`,
        description: `PayPal confirmed ${capture.currency} ${capture.chargedAmount || ''} for ${formatPaise(run.grandTotalPaise)}. Replenished ${lineItems.length} pantry items.`,
        statusBadge: 'Paid',
        badgeColor: 'emerald',
      });
      return { receipt, updatedRun: capturedRun, alreadyCaptured: false };
    });
    const result = captureTx();
    return { success: true, ...result, run: result.updatedRun };
  }
}
