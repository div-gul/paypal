import { PantryItem } from '../types';

export interface PantryStockStatus {
  status: 'STOCKED' | 'RUNNING_LOW' | 'CRITICAL' | 'STOCKOUT';
  badgeColor: 'emerald' | 'amber' | 'rose' | 'red';
  daysRemaining: number | null;
  daysRemainingText: string;
  isUrgent: boolean;
}

/**
 * Calculates estimated days remaining before stock reaches zero.
 * Handles zero consumption, invalid numbers, and negative inputs safely.
 */
export function calculateDaysRemaining(currentQty: number, dailyConsumption: number): number | null {
  if (currentQty <= 0) return 0;
  if (!dailyConsumption || dailyConsumption <= 0 || isNaN(dailyConsumption)) {
    return null; // Indefinite / non-consuming item
  }
  const days = currentQty / dailyConsumption;
  return Math.max(0, Math.round(days * 10) / 10);
}

/**
 * Forecasts expected stock at a future point in time
 */
export function forecastStock(currentQty: number, dailyConsumption: number, daysAhead: number): number {
  if (currentQty <= 0) return 0;
  if (!dailyConsumption || dailyConsumption <= 0 || daysAhead <= 0) return currentQty;
  const projected = currentQty - (dailyConsumption * daysAhead);
  return Math.max(0, Math.round(projected * 100) / 100);
}

/**
 * Evaluates stock health for a pantry item
 */
export function evaluateItemStockHealth(item: PantryItem, urgentThresholdDays: number = 3): PantryStockStatus {
  if (item.currentQuantity <= 0) {
    return {
      status: 'STOCKOUT',
      badgeColor: 'red',
      daysRemaining: 0,
      daysRemainingText: `Stockout (${item.stockoutDaysCount > 0 ? `${item.stockoutDaysCount}d ago` : 'Empty'})`,
      isUrgent: true,
    };
  }

  const daysRemaining = calculateDaysRemaining(item.currentQuantity, item.averageDailyConsumption);

  if (daysRemaining === null) {
    return {
      status: 'STOCKED',
      badgeColor: 'emerald',
      daysRemaining: null,
      daysRemainingText: 'Non-depleting',
      isUrgent: false,
    };
  }

  if (daysRemaining <= urgentThresholdDays || item.currentQuantity < item.minStockThreshold) {
    return {
      status: daysRemaining <= 1 ? 'CRITICAL' : 'RUNNING_LOW',
      badgeColor: daysRemaining <= 1 ? 'rose' : 'amber',
      daysRemaining,
      daysRemainingText: `${daysRemaining} days left`,
      isUrgent: daysRemaining <= urgentThresholdDays,
    };
  }

  return {
    status: 'STOCKED',
    badgeColor: 'emerald',
    daysRemaining,
    daysRemainingText: `${daysRemaining} days left`,
    isUrgent: false,
  };
}

/**
 * Advances simulated time and updates inventory based on daily consumption rates.
 * Correctly tracks stockout duration and ensures no negative quantities are treated as stock.
 */
export function advancePantryState(items: PantryItem[], daysToAdvance: number): PantryItem[] {
  if (daysToAdvance <= 0) return items;

  return items.map(item => {
    const dailyRate = Math.max(0, Number(item.averageDailyConsumption) || 0);
    const prevQty = Math.max(0, Number(item.currentQuantity) || 0);

    if (dailyRate === 0) {
      return item;
    }

    const totalDepletion = dailyRate * daysToAdvance;
    const remaining = prevQty - totalDepletion;

    if (remaining <= 0) {
      // Depleted to 0
      const daysUntilDepletion = prevQty > 0 ? prevQty / dailyRate : 0;
      const daysSpentInStockoutThisStep = Math.max(0, daysToAdvance - daysUntilDepletion);
      const updatedStockoutDays = (item.stockoutDaysCount || 0) + Math.round(daysSpentInStockoutThisStep);

      return {
        ...item,
        currentQuantity: 0,
        stockoutDaysCount: updatedStockoutDays,
      };
    }

    return {
      ...item,
      currentQuantity: Math.round(remaining * 100) / 100,
      stockoutDaysCount: 0,
    };
  });
}
