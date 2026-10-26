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

    // Quantity needed to reach target stock (in packages/units)
    let packSize = 1;
    const packMatch = item.preferredPackageSize?.match(/^([\d.]+)\s*(\w+)?$/);
    if (packMatch) {
      const parsedSize = parseFloat(packMatch[1]);
      const parsedUnit = (packMatch[2] || '').toLowerCase();
      const itemUnit = (item.unit || '').toLowerCase();
      if (
        !isNaN(parsedSize) &&
        parsedSize > 0 &&
        (parsedUnit === itemUnit || !parsedUnit || (itemUnit === 'eggs' && parsedUnit.includes('pc')))
      ) {
        packSize = parsedSize;
      }
    }
    const neededDeficit = Math.max(0, item.targetStock - projectedStockAtNextRun);
    const neededQtyUnits = Math.max(1, Math.ceil(neededDeficit / packSize));
    const estimatedItemCostPaise = selectedProduct ? selectedProduct.pricePaise * neededQtyUnits : 0;

    let outcome: RestockDecisionOutcome = 'WAIT_UNTIL_NEXT_CYCLE';
    let reasoning = '';
    let isUrgent = false;
    let requiresApproval = false;
    let approvalReason: string | undefined = undefined;

    // Case 1: Out of stock across all stores
    if (!selectedProduct) {
      outcome = 'BLOCKED';
      reasoning = `Out of stock across all stores${!item.allowSubstitutions ? ' (substitutions disallowed)' : ''}.`;
    }
    // Case 2: Immediate stockout right now (quantity = 0)
    else if (item.currentQuantity <= 0) {
      isUrgent = true;

      if (!selectedProduct.isExactBrandMatch && item.requireApprovalForBrandChange) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Brand substitution: "${selectedProduct.brand}".`;
        reasoning = `Depleted (0 left). Proposed substitute "${selectedProduct.brand}" requires approval.`;
      } else {
        outcome = 'RESTOCK_NOW';
        reasoning = `Depleted (0 left). Immediate emergency restock.`;
      }
    }
    // Case 3: Will run out BEFORE the next weekly shopping run
    else if (daysRemaining !== null && daysRemaining < daysUntilNextRun) {
      isUrgent = true;

      const needsBrandApproval = !selectedProduct.isExactBrandMatch && item.requireApprovalForBrandChange;

      if (needsBrandApproval) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Brand substitution: "${selectedProduct.brand}".`;
        reasoning = `${item.name} will run out in ${daysRemaining}d (before run in ${daysUntilNextRun}d). Substitute brand requires approval.`;
      } else if (config.emergencyRestockPreference === 'ask_approval') {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Incurs separate delivery fee.`;
        reasoning = `${item.name} will run out in ${daysRemaining}d (before run in ${daysUntilNextRun}d). Standalone order incurs delivery fee.`;
      } else if (config.emergencyRestockPreference === 'alert_only') {
        outcome = 'WAIT_UNTIL_NEXT_CYCLE';
        reasoning = `${item.name} will run out in ${daysRemaining}d. Alert only per policy.`;
      } else {
        // Auto-order emergency
        outcome = 'RESTOCK_NOW';
        reasoning = `${item.name} will run out in ${daysRemaining}d (before run in ${daysUntilNextRun}d). Urgent restock scheduled.`;
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
        approvalReason = `Exceeds cycle budget cap of ${formatPaise(config.perCycleBudgetPaise)}.`;
        reasoning = `Budget cap reached. Approval required.`;
      } else if (!selectedProduct.isExactBrandMatch && item.requireApprovalForBrandChange) {
        outcome = 'ASK_FOR_APPROVAL';
        requiresApproval = true;
        approvalReason = `Substitute brand "${selectedProduct.brand}".`;
        reasoning = `Low by next run. Substitute brand needs approval.`;
      } else {
        outcome = 'INCLUDE_IN_WEEKLY_BASKET';
        accumulatedBasketCostPaise += estimatedItemCostPaise;
        const daysLeftStr = daysRemaining !== null ? `lasts ~${daysRemaining}d` : 'safe';
        reasoning = `${item.name} ${daysLeftStr}, safe until run in ${daysUntilNextRun}d. Bundled into weekly basket.`;
      }
    }
    // Case 5: Plenty of stock remains, safely exceeding min threshold even after the run
    else {
      outcome = 'WAIT_UNTIL_NEXT_CYCLE';
      isUrgent = false;
      const daysStr = daysRemaining !== null ? `~${daysRemaining}d` : 'safe';
      reasoning = `${item.name} stock safe for ${daysStr}. Next run in ${daysUntilNextRun}d.`;
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
