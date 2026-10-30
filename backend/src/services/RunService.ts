import Database from 'better-sqlite3';
import { RunRepository, RunRecord, RunStatus } from '../repositories/RunRepository.js';
import { RunItemRepository, RunItemRecord } from '../repositories/RunItemRepository.js';
import { ApprovalRepository } from '../repositories/ApprovalRepository.js';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { PolicyRepository } from '../repositories/PolicyRepository.js';
import { SimClockRepository } from '../repositories/SimClockRepository.js';
import { AuditLogRepository } from '../repositories/AuditLogRepository.js';
import { generateRestockRecommendations } from '@shared/services/restockScheduler';
import { optimizeBaskets } from '@shared/services/basketOptimizer';
import { evaluatePolicy } from '@shared/policy';
import { formatPaise } from '@shared/services/currency';
import { AppError } from '../middleware/errorHandler.js';
import { BasketStrategyResult, BasketStrategyType, RestockRecommendation } from '@shared/types';

export interface PlanRunOverrides {
  includeItemIds?: string[];
  excludeItemIds?: string[];
  strategy?: BasketStrategyType;
}

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

  async planRun(userId: string, overrides?: PlanRunOverrides): Promise<PlanRunResult> {
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

    // 2. Apply optional overrides strictly when building the run (no pantry mutations)
    if (overrides?.excludeItemIds && overrides.excludeItemIds.length > 0) {
      recommendations.forEach(r => {
        if (overrides.excludeItemIds!.includes(r.itemId)) {
          r.outcome = 'WAIT_UNTIL_NEXT_CYCLE';
          r.recommendedQuantity = 0;
          r.requiresApproval = false;
          r.approvalStatus = 'approved';
          r.reasoning = 'Manually excluded by user override for this run.';
        }
      });
    }

    if (overrides?.includeItemIds && overrides.includeItemIds.length > 0) {
      recommendations.forEach(r => {
        if (overrides.includeItemIds!.includes(r.itemId)) {
          if (r.recommendedQuantity === 0) {
            const p = pantryItems.find(item => item.id === r.itemId);
            r.recommendedQuantity = Math.max(1, Math.ceil((p?.targetStock || 2) - (p?.currentQuantity || 0)));
          }
          r.outcome = r.isUrgent ? 'RESTOCK_NOW' : 'INCLUDE_IN_WEEKLY_BASKET';
          r.approvalStatus = 'approved';
          r.requiresApproval = false;
          r.reasoning = 'Manually bundled by user override for this run.';
        }
      });
    }

    // 3. Compute all 4 multi-store strategies
    const optimization = optimizeBaskets({
      recommendations,
      pantryItems,
    });

    // 4. Select strategy (from override or optimizer default)
    let chosenStrategy = optimization.recommendedStrategy;
    if (overrides?.strategy) {
      const matched = optimization.strategies.find(s => s.type === overrides.strategy);
      if (matched) {
        chosenStrategy = matched;
      }
    }

    // 5. Evaluate policy on chosen strategy
    const policyEval = evaluatePolicy({
      strategy: chosenStrategy,
      policy,
      pantryItems,
    });

    const initialStatus: RunStatus = policyEval.decision;
    const decisionReasons: string[] = [...policyEval.reasons];
    if (decisionReasons.length === 0) {
      decisionReasons.push(chosenStrategy.recommendationReason || 'Autonomous restock plan verified within all policy limits');
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 6. Persist run, all strategies, and line items in a database transaction
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
        allStrategies: optimization.strategies,
        simulatedDate: clock.simulatedDate,
      });

      // Insert line items
      let itemCounter = 0;
      const runItems = chosenStrategy.storeBaskets.flatMap(b =>
        b.items.map(item => {
          itemCounter++;
          const rec = recommendations.find(r => r.itemId === item.pantryItemId);
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
            isUrgent: rec?.isUrgent || false,
            outcome: rec?.outcome || 'RESTOCK_NOW',
            reasoning: rec?.reasoning || '',
            approvalStatus: 'approved' as const,
          };
        })
      );

      this.runItemRepo.createBatch(userId, runItems);

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

  /**
   * Switch the chosen strategy on an active run.
   * Re-evaluates policy and resets approval if the decision changes.
   */
  async selectRunStrategy(
    userId: string,
    runId: string,
    strategyType: BasketStrategyType
  ): Promise<PlanRunResult> {
    const run = this.getRunById(userId, runId);
    if (run.status === 'payment_pending' || run.status === 'paid' || run.status === 'failed') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        `Cannot change strategy on run with status "${run.status}".`,
        400
      );
    }

    const policy = this.policyRepo.getByUserId(userId);
    const pantryItems = this.pantryRepo.getAllByUserId(userId);
    const clock = this.clockRepo.getByUserId(userId);
    if (!policy || !clock) {
      throw new AppError('CONFIG_ERROR', 'User policy or clock is not initialized', 500);
    }

    // Retrieve or recompute strategies
    let allStrategies = run.allStrategies;
    let recommendations: RestockRecommendation[] = [];

    if (!allStrategies || allStrategies.length === 0) {
      recommendations = await generateRestockRecommendations({
        simulatedDate: clock.simulatedDate,
        config: policy,
        pantryItems,
      });
      const opt = optimizeBaskets({ recommendations, pantryItems });
      allStrategies = opt.strategies;
    }

    const newStrategy = allStrategies.find(s => s.type === strategyType);
    if (!newStrategy) {
      throw new AppError('STRATEGY_NOT_FOUND', `Strategy "${strategyType}" not available for run ${runId}`, 404);
    }

    // Re-evaluate policy on the new strategy
    const policyEval = evaluatePolicy({
      strategy: newStrategy,
      policy,
      pantryItems,
    });

    // Reset approval decision based on new policy outcome
    const newStatus: RunStatus = policyEval.decision;
    const decisionReasons: string[] = [...policyEval.reasons];
    if (decisionReasons.length === 0) {
      decisionReasons.push(newStrategy.recommendationReason || 'Autonomous restock plan verified within all policy limits');
    }

    const updateTx = this.db.transaction(() => {
      // 1. Update run record
      const updatedRun = this.runRepo.updateRunStrategy(userId, runId, {
        status: newStatus,
        strategyType: newStrategy.type,
        grandTotalPaise: newStrategy.grandTotalPaise,
        productSubtotalPaise: newStrategy.totalProductPaise,
        deliveryFeePaise: newStrategy.totalDeliveryFeePaise,
        handlingFeePaise: newStrategy.totalHandlingFeePaise,
        taxPaise: newStrategy.totalTaxPaise,
        decisionReasons,
        selectedStrategyDetails: newStrategy,
      });

      // 2. Replace line items to match new strategy
      this.db.prepare('DELETE FROM run_items WHERE user_id = ? AND run_id = ?').run(userId, runId);

      let itemCounter = 0;
      const runItems = newStrategy.storeBaskets.flatMap(b =>
        b.items.map(item => {
          itemCounter++;
          const rec = recommendations.find(r => r.itemId === item.pantryItemId);
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
            isUrgent: rec?.isUrgent || false,
            outcome: rec?.outcome || 'RESTOCK_NOW',
            reasoning: rec?.reasoning || '',
            approvalStatus: 'approved' as const,
          };
        })
      );
      this.runItemRepo.createBatch(userId, runItems);

      // 3. Log audit event
      this.auditRepo.create(userId, {
        id: `audit-${Date.now()}-strat-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: clock.simulatedDate,
        type: 'policy_applied',
        title: `Run Strategy Switched to ${newStrategy.title}`,
        description: `Strategy changed to ${newStrategy.title} (${formatPaise(
          newStrategy.grandTotalPaise
        )}). Status updated to "${newStatus}". Reasons: ${decisionReasons.join('; ')}`,
        statusBadge: newStatus.toUpperCase(),
        badgeColor: newStatus === 'auto_approved' ? 'emerald' : newStatus === 'needs_approval' ? 'amber' : 'red',
      });

      return updatedRun;
    });

    const updated = updateTx();

    return {
      run: updated,
      recommendations,
      strategies: allStrategies,
      recommendedStrategy: newStrategy,
    };
  }

  approveRun(userId: string, runId: string): RunRecord {
    const run = this.getRunById(userId, runId);

    // Idempotent: If already approved, return immediately
    if (run.status === 'approved') {
      return run;
    }

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

  getRunById(userId: string, id: string): RunRecord {
    const run = this.runRepo.getById(userId, id);
    if (!run) {
      throw new AppError('RUN_NOT_FOUND', `Run with ID "${id}" not found`, 404);
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
