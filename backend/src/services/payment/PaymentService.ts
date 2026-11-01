import Database from 'better-sqlite3';
import { IPaymentProvider, PaymentOrderResult } from './PaymentProvider.js';
import { MockPaymentProvider } from './MockPaymentProvider.js';
import { PayPalSandboxProvider } from './PayPalSandboxProvider.js';
import { RunRepository, RunRecord } from '../../repositories/RunRepository.js';
import { RunItemRepository } from '../../repositories/RunItemRepository.js';
import { ReceiptRepository, ReceiptRecord } from '../../repositories/ReceiptRepository.js';
import { PantryRepository } from '../../repositories/PantryRepository.js';
import { PolicyRepository } from '../../repositories/PolicyRepository.js';
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
  private policyRepo: PolicyRepository;
  private clockRepo: SimClockRepository;
  private auditRepo: AuditLogRepository;

  constructor(
    private db: Database.Database,
    customProvider?: IPaymentProvider
  ) {
    this.provider =
      customProvider ||
      (config.PAYPAL_MODE === 'sandbox'
        ? new PayPalSandboxProvider()
        : new MockPaymentProvider());

    this.runRepo = new RunRepository(db);
    this.runItemRepo = new RunItemRepository(db);
    this.receiptRepo = new ReceiptRepository(db);
    this.pantryRepo = new PantryRepository(db);
    this.policyRepo = new PolicyRepository(db);
    this.clockRepo = new SimClockRepository(db);
    this.auditRepo = new AuditLogRepository(db);
  }

  getProviderId(): string {
    return this.provider.providerId;
  }

  async createCheckoutOrder(userId: string, runId: string): Promise<PaymentOrderResult & { run: RunRecord }> {
    const run = this.runRepo.getById(userId, runId);
    if (!run) {
      throw new AppError('RUN_NOT_FOUND', `Run "${runId}" not found`, 404);
    }

    // 1. Re-run policy on stored run server-side. The client can never bypass this.
    const policy = this.policyRepo.getByUserId(userId);
    const pantryItems = this.pantryRepo.getAllByUserId(userId);
    const clock = this.clockRepo.getByUserId(userId);

    if (!policy || !clock) {
      throw new AppError('CONFIG_ERROR', 'Policy or clock not initialized', 500);
    }

    if (!run.selectedStrategyDetails) {
      throw new AppError('INVALID_RUN', 'Run is missing itemized strategy details', 400);
    }

    const policyEval = evaluatePolicy({
      strategy: run.selectedStrategyDetails,
      policy,
      pantryItems,
      isOffCycleEmergency: false,
    });

    if (policyEval.decision === 'blocked') {
      this.runRepo.updateStatus(userId, runId, 'blocked');
      throw new AppError(
        'POLICY_VIOLATION_BLOCKED',
        `Run is blocked by policy: ${policyEval.reasons.join('; ')}`,
        403
      );
    }

    // Checkout requires status to be 'approved' or 'auto_approved'
    if (run.status !== 'approved' && run.status !== 'auto_approved') {
      throw new AppError(
        'APPROVAL_REQUIRED',
        `Run status is "${run.status}". Checkout refuses payment unless status is "approved" or "auto_approved". Reason: ${policyEval.reasons.join('; ')}`,
        403
      );
    }

    // 2. Call Payment Provider
    const orderResult = await this.provider.createOrder(run);

    // 3. Mark run as payment_pending and record order_id
    const updatedRun = this.runRepo.setOrderId(userId, runId, orderResult.orderId);

    return {
      ...orderResult,
      run: updatedRun,
    };
  }

  async captureCheckoutOrder(
    userId: string,
    orderId: string,
    clientRunId?: string
  ): Promise<{
    success: boolean;
    receipt: ReceiptRecord;
    run: RunRecord;
    alreadyCaptured: boolean;
  }> {
    // 1. Idempotency check: capturing twice is a safe no-op
    const existingReceipt = this.receiptRepo.findByOrderId(userId, orderId);
    if (existingReceipt) {
      const run = this.runRepo.getById(userId, existingReceipt.runId);
      return {
        success: true,
        receipt: existingReceipt,
        run: run!,
        alreadyCaptured: true,
      };
    }

    // 2. Derive run from stored order and verify user ownership (never trust clientRunId alone)
    const run = this.runRepo.findByOrderId(orderId);
    if (!run) {
      throw new AppError('ORDER_NOT_FOUND', `No restock run found for order "${orderId}"`, 404);
    }
    if (run.userId !== userId) {
      throw new AppError('UNAUTHORIZED', `Order "${orderId}" does not belong to the authenticated user`, 403);
    }
    if (clientRunId && run.id !== clientRunId) {
      throw new AppError('RUN_MISMATCH', `Supplied runId "${clientRunId}" does not match order record`, 400);
    }

    const runId = run.id;

    // Ensure run is ready for capture
    if (run.status !== 'payment_pending' && run.status !== 'approved' && run.status !== 'auto_approved') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        `Run ${runId} in status "${run.status}" cannot be captured.`,
        400
      );
    }

    // 2. Capture through provider
    const captureResult = await this.provider.captureOrder(orderId);
    if (captureResult.status !== 'COMPLETED') {
      this.runRepo.updateStatus(userId, runId, 'failed');
      throw new AppError('PAYMENT_CAPTURE_FAILED', `Payment capture failed for order ${orderId}`, 402);
    }

    const clock = this.clockRepo.getByUserId(userId);
    const simDate = clock?.simulatedDate || new Date().toISOString();
    const lineItems = this.runItemRepo.getByRunId(userId, runId);
    const pantryItems = this.pantryRepo.getAllByUserId(userId);

    // 3. Atomic single-transaction: mark paid, create receipt, restock pantry, log audit
    const captureTx = this.db.transaction(() => {
      // a. Mark run paid
      const updatedRun = this.runRepo.updateStatus(userId, runId, 'paid');

      // b. Create receipt
      const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const receipt = this.receiptRepo.create(userId, {
        id: receiptId,
        runId,
        orderId,
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
      });

      // c. Restock pantry items to target stock or add purchased qty
      const updatedPantry = pantryItems.map(p => {
        const purchased = lineItems.find(li => li.pantryItemId === p.id);
        if (purchased) {
          const newQty = Math.max(p.targetStock, Math.round((p.currentQuantity + purchased.quantity) * 100) / 100);
          return {
            ...p,
            currentQuantity: newQty,
            lastRestockedDate: simDate,
            stockoutDaysCount: 0,
          };
        }
        return p;
      });

      this.pantryRepo.batchSave(userId, updatedPantry);

      // d. Write audit log entry
      this.auditRepo.create(userId, {
        id: `audit-${Date.now()}-checkout-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: simDate,
        type: 'checkout_completed',
        title: `Payment Captured (${orderId})`,
        description: `Successfully processed order of ${formatPaise(
          run.grandTotalPaise
        )} via ${this.provider.providerId}. Replenished ${lineItems.length} pantry items to target levels.`,
        statusBadge: 'Paid',
        badgeColor: 'emerald',
      });

      return { receipt, updatedRun };
    });

    const { receipt, updatedRun } = captureTx();

    return {
      success: true,
      receipt,
      run: updatedRun,
      alreadyCaptured: false,
    };
  }
}
