import Database from 'better-sqlite3';
import { RunRepository, RunRecord, RunStatus } from '../repositories/RunRepository.js';
import { RunItemRepository } from '../repositories/RunItemRepository.js';
import { ApprovalRepository } from '../repositories/ApprovalRepository.js';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { PolicyRepository } from '../repositories/PolicyRepository.js';
import { SimClockRepository } from '../repositories/SimClockRepository.js';
import { AuditLogRepository } from '../repositories/AuditLogRepository.js';
import { generateRestockRecommendations } from '@shared/services/restockScheduler';
import { optimizeBaskets } from '@shared/services/basketOptimizer';
import { formatPaise } from '@shared/services/currency';
import { AppError } from '../middleware/errorHandler.js';
import { BasketStrategyResult, RestockRecommendation } from '@shared/types';

export interface PlanRunResult {
  run: RunRecord;
  recommendations: RestockRecommendation[];
  strategies: BasketStrategyResult[];
  recommendedStrategy: BasketStrategyResult;
}

export class RunService {
  private runRepo: RunRepository;
  private runItemRepo: RunItemRepository;
  private approvalRepo: ApprovalRepository;
  private pantryRepo: PantryRepository;
  private policyRepo: PolicyRepository;
  private clockRepo: SimClockRepository;
  private auditRepo: AuditLogRepository;

  constructor(private db: Database.Database) {
    this.runRepo = new RunRepository(db);
    this.runItemRepo = new RunItemRepository(db);
    this.approvalRepo = new ApprovalRepository(db);
    this.pantryRepo = new PantryRepository(db);
    this.policyRepo = new PolicyRepository(db);
    this.clockRepo = new SimClockRepository(db);
    this.auditRepo = new AuditLogRepository(db);
  }

  async planRun(userId: string): Promise<PlanRunResult> {
    const pantryItems = this.pantryRepo.getAllByUserId(userId);
    const policy = this.policyRepo.getByUserId(userId);
    const clock = this.clockRepo.getByUserId(userId);

    if (!policy || !clock) {
      throw new AppError('CONFIG_ERROR', 'User policy or clock is not initialized', 500);
    }

    // 1. Generate autonomous restock recommendations
    const recommendations = await generateRestockRecommendations({
      simulatedDate: clock.simulatedDate,
      config: policy,
      pantryItems,
    });

    // 2. Compute 4 multi-store strategies
    const optimization = optimizeBaskets({
      recommendations,
      pantryItems,
    });

    const chosenStrategy = optimization.recommendedStrategy;
    const decisionReasons: string[] = [];
    let initialStatus: RunStatus = 'auto_approved';

    // 3. Policy & Approval Evaluation
    // Check blocked categories
    const blockedCategories = policy.blockedCategories || [];
    const hasBlockedCategory = chosenStrategy.storeBaskets.some(basket =>
      basket.items.some(item => {
        const pItem = pantryItems.find(p => p.id === item.pantryItemId);
        return pItem && blockedCategories.includes(pItem.category);
      })
    );

    if (hasBlockedCategory) {
      initialStatus = 'blocked';
      decisionReasons.push('Contains items from user-blocked categories');
    }

    // Check budget caps
    if (policy.perOrderCapPaise > 0 && chosenStrategy.grandTotalPaise > policy.perOrderCapPaise) {
      initialStatus = 'needs_approval';
      decisionReasons.push(
        `Total basket ${formatPaise(chosenStrategy.grandTotalPaise)} exceeds per-order cap of ${formatPaise(
          policy.perOrderCapPaise
        )}`
      );
    }

    if (policy.perCycleBudgetPaise > 0 && chosenStrategy.grandTotalPaise > policy.perCycleBudgetPaise) {
      initialStatus = 'needs_approval';
      decisionReasons.push(
        `Total basket exceeds cycle budget cap of ${formatPaise(policy.perCycleBudgetPaise)}`
      );
    }

    // Check urgent item approvals & substitutions
    const itemsNeedingApproval = recommendations.filter(r => r.requiresApproval);
    if (itemsNeedingApproval.length > 0) {
      if (initialStatus !== 'blocked') {
        initialStatus = 'needs_approval';
      }
      for (const item of itemsNeedingApproval) {
        decisionReasons.push(
          `${item.itemName}: ${item.approvalReason || 'Requires approval per restocking policy'}`
        );
      }
    }

    if (decisionReasons.length === 0) {
      decisionReasons.push(chosenStrategy.recommendationReason || 'Autonomous restock plan verified within all policy limits');
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 4. Persist run and line items in a database transaction
    const planTx = this.db.transaction(() => {
      const run = this.runRepo.create(userId, {
        id: runId,
        status: initialStatus,
        strategyType: chosenStrategy.type,
        grandTotalPaise: chosenStrategy.grandTotalPaise,
        productSubtotalPaise: chosenStrategy.totalProductPaise,
        deliveryFeePaise: chosenStrategy.totalDeliveryFeePaise,
        handlingFeePaise: chosenStrategy.totalHandlingFeePaise,
        taxPaise: chosenStrategy.totalTaxPaise,
        discountPaise: chosenStrategy.totalDiscountPaise,
        decisionReasons,
        selectedStrategyDetails: chosenStrategy,
        simulatedDate: clock.simulatedDate,
      });

      // Insert line items
      let itemCounter = 0;
      const runItems = chosenStrategy.storeBaskets.flatMap(b =>
        b.items.map(item => {
          itemCounter++;
          return {
            id: `ri-${runId}-${b.storeId}-${item.pantryItemId}-${itemCounter}`,
            runId,
            pantryItemId: item.pantryItemId,
            itemName: item.product.name,
            storeId: b.storeId,
            storeProductId: item.product.id,
            quantity: item.quantity,
            unitPricePaise: item.product.pricePaise,
            totalPricePaise: item.totalPaise,
            isSubstitution: item.isSubstitution,
            isUrgent: recommendations.find(r => r.itemId === item.pantryItemId)?.isUrgent || false,
            outcome: recommendations.find(r => r.itemId === item.pantryItemId)?.outcome || 'RESTOCK_NOW',
            reasoning: recommendations.find(r => r.itemId === item.pantryItemId)?.reasoning || '',
            approvalStatus: 'approved' as const,
          };
        })
      );

      this.runItemRepo.createBatch(userId, runItems);

      // Create approvals if needed
      if (initialStatus === 'needs_approval') {
        for (const item of itemsNeedingApproval) {
          this.approvalRepo.create(userId, {
            id: `appr-${runId}-${item.itemId}`,
            runId,
            itemId: item.itemId,
            type: item.selectedProduct?.isExactBrandMatch ? 'emergency_run' : 'brand_substitution',
            status: 'pending',
            reason: item.approvalReason || item.reasoning,
          });
        }
      }

      // Record audit log entry
      this.auditRepo.create(userId, {
        id: `audit-${Date.now()}-plan-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: clock.simulatedDate,
        type: 'analysis_run',
        title: `Restock Plan Generated (${initialStatus})`,
        description: `Autonomous analysis proposed ${chosenStrategy.title} for ${formatPaise(
          chosenStrategy.grandTotalPaise
        )}. ${decisionReasons.join('; ')}`,
        statusBadge: initialStatus.toUpperCase(),
        badgeColor: initialStatus === 'auto_approved' ? 'emerald' : initialStatus === 'needs_approval' ? 'amber' : 'red',
      });

      return run;
    });

    const run = planTx();

    return {
      run,
      recommendations,
      strategies: optimization.strategies,
      recommendedStrategy: chosenStrategy,
    };
  }

  approveRun(userId: string, runId: string): RunRecord {
    const run = this.getRunById(userId, runId);

    // Validate state transition
    if (run.status !== 'needs_approval') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        `Run ${runId} cannot be approved from status "${run.status}". Valid only from "needs_approval".`,
        400
      );
    }

    const updated = this.runRepo.updateStatus(userId, runId, 'approved');

    // Audit log
    const clock = this.clockRepo.getByUserId(userId);
    this.auditRepo.create(userId, {
      id: `audit-${Date.now()}-appr-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      simulatedDate: clock?.simulatedDate || new Date().toISOString(),
      type: 'approval_granted',
      title: `Restock Run Approved (${runId})`,
      description: `User approved run basket totaling ${formatPaise(run.grandTotalPaise)}. Ready for checkout.`,
      statusBadge: 'Approved',
      badgeColor: 'emerald',
    });

    return updated;
  }

  rejectRun(userId: string, runId: string): RunRecord {
    const run = this.getRunById(userId, runId);

    if (run.status !== 'needs_approval') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        `Run ${runId} cannot be rejected from status "${run.status}". Valid only from "needs_approval".`,
        400
      );
    }

    const updated = this.runRepo.updateStatus(userId, runId, 'rejected');

    const clock = this.clockRepo.getByUserId(userId);
    this.auditRepo.create(userId, {
      id: `audit-${Date.now()}-rej-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      simulatedDate: clock?.simulatedDate || new Date().toISOString(),
      type: 'approval_rejected',
      title: `Restock Run Rejected (${runId})`,
      description: `User rejected proposed restock run.`,
      statusBadge: 'Rejected',
      badgeColor: 'rose',
    });

    return updated;
  }

  getRunById(userId: string, runId: string): RunRecord {
    const run = this.runRepo.getById(userId, runId);
    if (!run) {
      throw new AppError('RUN_NOT_FOUND', `Run with ID "${runId}" not found`, 404);
    }
    return run;
  }

  getRuns(userId: string, limit: number = 20): RunRecord[] {
    return this.runRepo.getAll(userId, limit);
  }

  getActiveRun(userId: string): RunRecord | null {
    return this.runRepo.getLatest(userId);
  }
}
