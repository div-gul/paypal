import { BasketStrategyResult, PantryItem, WeeklySchedulerConfig } from './types';
import { formatPaise } from './services/currency';

export interface PolicyCheckContext {
  strategy: BasketStrategyResult;
  policy: WeeklySchedulerConfig & {
    perOrderCapPaise?: number;
    requireApprovalBrandSubstitution?: boolean;
    requireApprovalEmergencyRun?: boolean;
    blockedCategories?: string[];
  };
  pantryItems: PantryItem[];
  isOffCycleEmergency?: boolean;
}

export type PolicyDecision = 'auto_approved' | 'needs_approval' | 'blocked';

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reasons: string[];
  canCheckout: boolean;
}

/**
 * Pure deterministic policy evaluation engine.
 * Executed on both planned restock baskets and server-side at checkout time.
 * The client can never bypass these rules.
 */
export function evaluatePolicy(context: PolicyCheckContext): PolicyEvaluationResult {
  const { strategy, policy, pantryItems, isOffCycleEmergency = false } = context;
  const reasons: string[] = [];
  let decision: PolicyDecision = 'auto_approved';

  const blockedCategories = policy.blockedCategories || [];
  const perOrderCapPaise = policy.perOrderCapPaise || 150000; // default ₹1,500.00
  const perCycleBudgetPaise = policy.perCycleBudgetPaise || 250000; // default ₹2,500.00
  const requireApprovalBrandSub = policy.requireApprovalBrandSubstitution ?? true;
  const requireApprovalEmergency = policy.requireApprovalEmergencyRun ?? (policy.emergencyRestockPreference === 'ask_approval');

  const pantryMap = new Map(pantryItems.map(p => [p.id, p]));

  // Rule 1: Blocked Categories (Hard Block)
  for (const basket of strategy.storeBaskets) {
    for (const item of basket.items) {
      const pantryItem = pantryMap.get(item.pantryItemId);
      if (pantryItem && blockedCategories.includes(pantryItem.category)) {
        decision = 'blocked';
        reasons.push(
          `Contains item "${pantryItem.name}" from restricted category "${pantryItem.category}"`
        );
      }
    }
  }

  // If hard blocked, return immediately
  if (decision === 'blocked') {
    return {
      decision: 'blocked',
      reasons,
      canCheckout: false,
    };
  }

  // Rule 2: Per-Order Spending Cap
  if (perOrderCapPaise > 0 && strategy.grandTotalPaise > perOrderCapPaise) {
    decision = 'needs_approval';
    reasons.push(
      `Total cost ${formatPaise(strategy.grandTotalPaise)} exceeds per-order spending cap of ${formatPaise(
        perOrderCapPaise
      )}`
    );
  }

  // Rule 3: Weekly / Cycle Budget Cap
  if (perCycleBudgetPaise > 0 && strategy.grandTotalPaise > perCycleBudgetPaise) {
    decision = 'needs_approval';
    reasons.push(
      `Total cost ${formatPaise(strategy.grandTotalPaise)} exceeds cycle budget limit of ${formatPaise(
        perCycleBudgetPaise
      )}`
    );
  }

  // Rule 4: Brand Substitution Approval
  if (requireApprovalBrandSub) {
    for (const basket of strategy.storeBaskets) {
      for (const item of basket.items) {
        if (item.isSubstitution) {
          const pantryItem = pantryMap.get(item.pantryItemId);
          decision = 'needs_approval';
          reasons.push(
            `Substitute brand "${item.product.brand}" selected for "${pantryItem ? pantryItem.name : item.product.name}"`
          );
        }
      }
    }
  }

  // Rule 5: Off-Cycle Emergency Restock Delivery Fee Incurrence
  if (isOffCycleEmergency && requireApprovalEmergency) {
    decision = 'needs_approval';
    reasons.push('Off-cycle emergency run incurs standalone delivery and handling charges');
  }

  if (reasons.length === 0) {
    reasons.push('All items and order totals are within autonomous policy thresholds');
  }

  return {
    decision,
    reasons,
    canCheckout: decision === 'auto_approved',
  };
}
