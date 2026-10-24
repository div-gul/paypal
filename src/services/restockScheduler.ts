import {
  PantryItem,
  RestockDecisionOutcome,
  RestockRecommendation,
  WeeklySchedulerConfig,
  StoreProduct,
} from '../types';
import { calculateDaysRemaining, forecastStock } from './consumptionEngine';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { formatPaise } from './currency';

export interface SchedulerContext {
  simulatedDate: string; // ISO
  config: WeeklySchedulerConfig;
  pantryItems: PantryItem[];
}

/**
 * Calculates days difference between current simulated date and next scheduled shopping run
 */
export function getDaysUntilNextShoppingRun(currentDateIso: string, nextDateIso: string): number {
  const current = new Date(currentDateIso);
  const next = new Date(nextDateIso);
  const diffTime = next.getTime() - current.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Core Autonomous Restocking Decision Engine
 */
export async function generateRestockRecommendations(
  context: SchedulerContext
): Promise<RestockRecommendation[]> {
  const { simulatedDate, config, pantryItems } = context;
  const daysUntilNextRun = getDaysUntilNextShoppingRun(simulatedDate, config.nextShoppingDate);
  const adapters = AdapterRegistry.getAllAdapters();

  const recommendations: RestockRecommendation[] = [];
  let accumulatedBasketCostPaise = 0;

  for (const item of pantryItems) {
    const daysRemaining = calculateDaysRemaining(item.currentQuantity, item.averageDailyConsumption);
    const projectedStockAtNextRun = forecastStock(
      item.currentQuantity,
      item.averageDailyConsumption,
      daysUntilNextRun
    );

    // Find available products across stores
    const candidateProducts: { storeId: string; product: StoreProduct }[] = [];
    for (const adapter of adapters) {
      const prod = await adapter.getProductForPantryItem(item);
      if (prod && prod.inStock) {
        candidateProducts.push({ storeId: adapter.storeId, product: prod });
      }
    }

    // Sort candidates: prefer exact brand, then lowest price
    candidateProducts.sort((a, b) => {
      if (a.product.isExactBrandMatch && !b.product.isExactBrandMatch) return -1;
      if (!a.product.isExactBrandMatch && b.product.isExactBrandMatch) return 1;
      return a.product.pricePaise - b.product.pricePaise;
    });

    const bestOption = candidateProducts[0] || null;
    const selectedStore = bestOption ? bestOption.product.storeId : null;
    const selectedProduct = bestOption ? bestOption.product : null;

    // Quantity needed to reach target stock
    const neededQtyUnits = Math.max(1, Math.ceil(item.targetStock - projectedStockAtNextRun));
    const estimatedItemCostPaise = selectedProduct ? selectedProduct.pricePaise * neededQtyUnits : 0;

    let outcome: RestockDecisionOutcome = 'WAIT_UNTIL_NEXT_CYCLE';
    let reasoning = '';
    let isUrgent = false;
    let requiresApproval = false;
    let approvalReason: string | undefined = undefined;

    // Case 1: Out of stock across all stores
    if (!selectedProduct) {
      outcome = 'BLOCKED';
      reasoning = `Your ${item.name} requires restocking, but no acceptable in-stock product was found across Blinkit, Zepto, or Instamart${
        !item.allowSubstitutions ? ' (substitutions are currently disallowed)' : ''
      }. Restocking is blocked until inventory refreshes.`;
    }
    // Case 2: Immediate stockout right now (quantity = 0)
    else if (item.currentQuantity <= 0) {
      isUrgent = true;

      // Check if substitution needs approval
      if (!selectedProduct.isExactBrandMatch && item.requireApprovalForBrandChange) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Brand substitution required: Preferred brand "${item.preferredBrand}" unavailable; proposing "${selectedProduct.brand}" at ${formatPaise(selectedProduct.pricePaise)}.`;
        reasoning = `Your ${item.name} is completely out of stock (${item.stockoutDaysCount > 0 ? `empty for ${item.stockoutDaysCount} days` : '0 left'}). Proposed substitute "${selectedProduct.brand}" requires your approval.`;
      } else {
        outcome = 'RESTOCK_NOW';
        reasoning = `Your ${item.name} is completely depleted (0 ${item.unit} remaining). Immediate emergency restock is recommended rather than waiting ${daysUntilNextRun} days for the weekly run.`;
      }
    }
    // Case 3: Will run out BEFORE the next weekly shopping run
    else if (daysRemaining !== null && daysRemaining < daysUntilNextRun) {
      isUrgent = true;

      const needsBrandApproval = !selectedProduct.isExactBrandMatch && item.requireApprovalForBrandChange;

      if (needsBrandApproval) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Proposed alternative brand "${selectedProduct.brand}" to replace preferred "${item.preferredBrand}".`;
        reasoning = `Your ${item.name} has only ${item.currentQuantity} ${item.unit} remaining and is projected to run out in ${daysRemaining} days (before your next shopping run in ${daysUntilNextRun} days). Substitute brand requires your confirmation.`;
      } else if (config.emergencyRestockPreference === 'ask_approval') {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Early restock requested: Runs out in ${daysRemaining} days (next cycle is ${daysUntilNextRun} days away). Separate order incurs delivery fees.`;
        reasoning = `Your ${item.name} is expected to run out in ${daysRemaining} days, before your next scheduled shopping run in ${daysUntilNextRun} days. An urgent standalone order incurs delivery fees; requesting approval per your emergency restock policy.`;
      } else if (config.emergencyRestockPreference === 'alert_only') {
        outcome = 'WAIT_UNTIL_NEXT_CYCLE';
        reasoning = `Your ${item.name} will run out in ${daysRemaining} days (before the next shopping run in ${daysUntilNextRun} days). Flagged per policy (Alert Only: no automatic off-cycle order created).`;
      } else {
        // Auto-order emergency
        outcome = 'RESTOCK_NOW';
        reasoning = `Your ${item.name} is expected to run out in ${daysRemaining} days, before your next scheduled shopping run in ${daysUntilNextRun} days. An urgent early purchase is scheduled.`;
      }
    }
    // Case 4: Stock will last until next run, but will be at or below minimum threshold
    else if (projectedStockAtNextRun <= item.minStockThreshold) {
      isUrgent = false;

      // Check budget limit
      if (
        config.perCycleBudgetPaise > 0 &&
        accumulatedBasketCostPaise + estimatedItemCostPaise > config.perCycleBudgetPaise
      ) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Weekly budget limit of ${formatPaise(config.perCycleBudgetPaise)} exceeded by adding this item.`;
        reasoning = `Your ${item.name} safely lasts until your scheduled run in ${daysUntilNextRun} days, but adding it will exceed your configured cycle budget (${formatPaise(config.perCycleBudgetPaise)}).`;
      } else if (!selectedProduct.isExactBrandMatch && item.requireApprovalForBrandChange) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Proposed alternative brand "${selectedProduct.brand}" in weekly basket requires confirmation.`;
        reasoning = `Your ${item.name} will reach safety threshold (${item.minStockThreshold} ${item.unit}) by next run. Proposing substitute brand "${selectedProduct.brand}" for the weekly basket.`;
      } else {
        outcome = 'INCLUDE_IN_WEEKLY_BASKET';
        accumulatedBasketCostPaise += estimatedItemCostPaise;
        const daysLeftStr = daysRemaining !== null ? `lasts ~${daysRemaining} days` : 'safe';
        reasoning = `Your ${item.name} has ${item.currentQuantity} ${item.unit} remaining (${daysLeftStr}), safely lasting until your shopping run in ${daysUntilNextRun} days. Restocking is bundled into the weekly basket to eliminate standalone delivery fees.`;
      }
    }
    // Case 5: Plenty of stock remains, safely exceeding min threshold even after the run
    else {
      outcome = 'WAIT_UNTIL_NEXT_CYCLE';
      isUrgent = false;
      const daysStr = daysRemaining !== null ? `${daysRemaining} days` : 'indefinitely';
      reasoning = `Your ${item.name} is expected to last another ${daysStr} (projected ${projectedStockAtNextRun} ${item.unit} remaining at next run). Since your next shopping run is in ${daysUntilNextRun} days, there is no need to purchase it today.`;
    }

    recommendations.push({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      currentQuantity: item.currentQuantity,
      unit: item.unit,
      daysRemaining,
      projectedStockAtNextRun,
      isUrgent,
      outcome,
      reasoning,
      recommendedQuantity: outcome === 'WAIT_UNTIL_NEXT_CYCLE' || outcome === 'BLOCKED' ? 0 : neededQtyUnits,
      targetPackageSize: item.preferredPackageSize,
      selectedStore,
      selectedProduct,
      requiresApproval,
      approvalStatus: requiresApproval ? 'pending' : 'approved',
      approvalReason,
    });
  }

  return recommendations;
}
