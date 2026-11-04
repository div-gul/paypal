import Database from 'better-sqlite3';
import { RunRepository, RunRecord, RunStatus } from '../repositories/RunRepository.js';
import { RunItemRepository } from '../repositories/RunItemRepository.js';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { PolicyService } from './PolicyService.js';
import { SimClockRepository } from '../repositories/SimClockRepository.js';
import { AuditLogRepository } from '../repositories/AuditLogRepository.js';
import { generateRestockRecommendations } from '@shared/services/restockScheduler';
import { optimizeBaskets } from '@shared/services/basketOptimizer';
import { evaluatePolicy } from '@shared/policy';
import { formatPaise } from '@shared/services/currency';
import { AppError } from '../middleware/errorHandler.js';
import { BasketItem, BasketStrategyResult, BasketStrategyType, RestockRecommendation, StoreId } from '@shared/types';
import { MOCK_STORE_CATALOG, STORE_DEFINITIONS } from '@shared/adapters/mockStoreData';

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

export interface OrderRunItemInput {
  pantryItemId: string;
  storeProductId: string;
  quantity: number;
}

export class RunService {
  private runRepo: RunRepository;
  private runItemRepo: RunItemRepository;
  private pantryRepo: PantryRepository;
  private clockRepo: SimClockRepository;
  private auditRepo: AuditLogRepository;

  constructor(private db: Database.Database) {
    this.runRepo = new RunRepository(db);
    this.runItemRepo = new RunItemRepository(db);
    this.pantryRepo = new PantryRepository(db);
    this.clockRepo = new SimClockRepository(db);
    this.auditRepo = new AuditLogRepository(db);
  }

  async planRun(userId: string, overrides?: PlanRunOverrides): Promise<PlanRunResult> {
    const pantryItems = this.pantryRepo.getAllByUserId(userId);
    if (pantryItems.length === 0) {
      throw new AppError('PANTRY_EMPTY', 'Add pantry items before planning a restock run.', 400);
    }
    const policy = new PolicyService(this.db).getPolicy(userId);
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

  createOrderRun(userId: string, requestedItems: OrderRunItemInput[]): RunRecord {
    if (requestedItems.length === 0) {
      throw new AppError('EMPTY_ORDER', 'Add at least one item before checkout.', 400);
    }

    const runItems: Array<{ basketItem: BasketItem; storeId: StoreId }> = [];
    const pantryItems = this.pantryRepo.getAllByUserId(userId);
    const pantryById = new Map(pantryItems.map(item => [item.id, item]));
    for (const requested of requestedItems) {
      if (!Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > 99) {
        throw new AppError('INVALID_ORDER_ITEM', 'Order quantities must be whole numbers from 1 to 99.', 400);
      }
      const pantryItem = pantryById.get(requested.pantryItemId);
      const product = MOCK_STORE_CATALOG.find(candidate =>
        candidate.id === requested.storeProductId && candidate.pantryItemId === requested.pantryItemId && candidate.inStock
      );
      if (!pantryItem || !product) {
        throw new AppError('INVALID_ORDER_ITEM', 'An order item is unavailable or does not belong to this household.', 400);
      }
      runItems.push({
        storeId: product.storeId,
        basketItem: {
          product,
          pantryItemId: pantryItem.id,
          quantity: requested.quantity,
          totalPaise: product.pricePaise * requested.quantity,
          isSubstitution: product.brand.toLowerCase() !== pantryItem.preferredBrand.toLowerCase(),
        },
      });
    }

    const grouped = new Map<StoreId, BasketItem[]>();
    for (const { storeId, basketItem } of runItems) {
      const basket = grouped.get(storeId) || [];
      basket.push(basketItem);
      grouped.set(storeId, basket);
    }
    const subtotalPaise = runItems.reduce((sum, item) => sum + item.basketItem.totalPaise, 0);
    // Match the editable order bucket: one ₹20 delivery fee, waived at ₹399.
    const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
    const storeBaskets = [...grouped.entries()].map(([storeId, items], index) => {
      const productSubtotalPaise = items.reduce((sum, item) => sum + item.totalPaise, 0);
      const basketDeliveryFeePaise = index === 0 ? deliveryFeePaise : 0;
      return {
        storeId,
        storeName: STORE_DEFINITIONS[storeId].name,
        items,
        productSubtotalPaise,
        deliveryFeePaise: basketDeliveryFeePaise,
        handlingFeePaise: 0,
        taxPaise: 0,
        discountsPaise: 0,
        minOrderShortfallPaise: 0,
        totalPaise: productSubtotalPaise + basketDeliveryFeePaise,
        meetsMinOrder: true,
        minOrderThresholdPaise: STORE_DEFINITIONS[storeId].minOrderThresholdPaise,
      };
    });
    const strategyType: BasketStrategyType = storeBaskets.length > 1 ? 'STRATEGY_C_SMART_SPLIT' : 'STRATEGY_B_SINGLE_STORE';
    const strategy: BasketStrategyResult = {
      type: strategyType,
      title: 'Approved Household Order',
      tag: 'User approved',
      description: 'The exact products and quantities from the approved upcoming order.',
      storeBaskets,
      totalProductPaise: subtotalPaise,
      totalDeliveryFeePaise: deliveryFeePaise,
      totalHandlingFeePaise: 0,
      totalTaxPaise: 0,
      totalDiscountPaise: 0,
      grandTotalPaise: subtotalPaise + deliveryFeePaise,
      isRecommended: true,
      recommendationReason: 'Matches the saved order contents.',
      storesInvolvedCount: storeBaskets.length,
    };

    const policy = new PolicyService(this.db).getPolicy(userId);
    const clock = this.clockRepo.getByUserId(userId);
    if (!policy || !clock) throw new AppError('CONFIG_ERROR', 'User policy or clock not initialized', 500);
    const policyResult = evaluatePolicy({ strategy, policy, pantryItems });
    if (policyResult.decision === 'blocked') {
      throw new AppError('POLICY_VIOLATION_BLOCKED', `This order is blocked by policy: ${policyResult.reasons.join('; ')}`, 403);
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createTx = this.db.transaction(() => {
      const run = this.runRepo.create(userId, {
        id: runId,
        status: 'approved',
        strategyType,
        grandTotalPaise: strategy.grandTotalPaise,
        productSubtotalPaise: subtotalPaise,
        deliveryFeePaise,
        handlingFeePaise: 0,
        taxPaise: 0,
        discountPaise: 0,
        decisionReasons: ['User explicitly approved the saved upcoming order.'],
        selectedStrategyDetails: strategy,
        allStrategies: [strategy],
        simulatedDate: clock.simulatedDate,
      });
      this.runItemRepo.createBatch(userId, runItems.map(({ storeId, basketItem }, index) => ({
        id: `ri-${runId}-${storeId}-${basketItem.pantryItemId}-${index + 1}`,
        runId,
        pantryItemId: basketItem.pantryItemId,
        itemName: basketItem.product.name,
        storeId,
        storeProductId: basketItem.product.id,
        quantity: basketItem.quantity,
        unitPricePaise: basketItem.product.pricePaise,
        totalPricePaise: basketItem.totalPaise,
        isSubstitution: basketItem.isSubstitution,
        isUrgent: false,
        outcome: 'INCLUDE_IN_WEEKLY_BASKET',
        reasoning: 'Included in the user-approved upcoming order.',
        approvalStatus: 'approved' as const,
      })));
      this.auditRepo.create(userId, {
        id: `audit-${Date.now()}-order-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: clock.simulatedDate,
        type: 'approval_granted',
        title: 'Upcoming Order Approved',
        description: `Approved ${runItems.length} saved order item(s) totaling ${formatPaise(strategy.grandTotalPaise)}.`,
        statusBadge: 'Approved',
        badgeColor: 'emerald',
      });
      return run;
    });
    return createTx();
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

    const policy = new PolicyService(this.db).getPolicy(userId);
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
