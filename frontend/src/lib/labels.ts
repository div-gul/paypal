/**
 * User-friendly label and copy mappings for ShopPilot AI.
 * Normalizes backend states, technical strategies, and system phrases
 * into simple, friendly household language.
 */

const STRATEGY_FRIENDLY_NAMES: Record<string, { label: string; badge: string; description: string }> = {
  STRATEGY_A_LOWEST_PRICE: {
    label: 'Lowest item prices',
    badge: 'Split order',
    description: 'Finds the cheapest price per item across multiple stores.',
  },
  STRATEGY_B_SINGLE_STORE: {
    label: 'Best value',
    badge: 'Recommended',
    description: 'Consolidates into one store to save on multiple delivery fees.',
  },
  STRATEGY_C_FASTER_DELIVERY: {
    label: 'One delivery',
    badge: 'Fastest',
    description: 'Single store order with fastest arrival time.',
  },
  STRATEGY_D_DEFER_NON_URGENT: {
    label: 'Only what’s urgent',
    badge: 'Essential run',
    description: 'Orders only items running low now and defers the rest.',
  },
};


import { BasketStrategyResult } from '../types';

export interface RankedStrategy extends BasketStrategyResult {
  friendlyName: string;
  friendlyBadge: string;
  friendlyDescription: string;
  deferredCount?: number;
}

/**
 * Dedupes strategies with identical totals and returns at most 3 cleanly labeled options:
 * 1. Best value (recommended)
 * 2. Lowest item prices (or next unique option)
 * 3. Urgent only (visually separate, labeled "Defers N items")
 */
export function filterAndRankStrategies(
  strategies: BasketStrategyResult[],
  recommendedStrategy?: BasketStrategyResult,
  totalRestockableItemsCount: number = 0
): RankedStrategy[] {
  if (!strategies || strategies.length === 0) return [];

  // Deduplicate ties by grandTotalPaise
  const seenTotals = new Set<number>();
  const uniqueStrategies: RankedStrategy[] = [];

  // Ensure recommended is considered first
  const sorted = [...strategies].sort((a, b) => {
    if (recommendedStrategy && a.type === recommendedStrategy.type) return -1;
    if (recommendedStrategy && b.type === recommendedStrategy.type) return 1;
    return a.grandTotalPaise - b.grandTotalPaise;
  });

  for (const s of sorted) {
    if (!seenTotals.has(s.grandTotalPaise) || (recommendedStrategy && s.type === recommendedStrategy.type)) {
      seenTotals.add(s.grandTotalPaise);
      const meta = STRATEGY_FRIENDLY_NAMES[s.type] || {
        label: s.title || 'Store order',
        badge: 'Alternative',
        description: s.recommendationReason || '',
      };

      const itemsInBasketCount = s.storeBaskets?.reduce(
        (sum: number, b: any) => sum + (b.items?.length || 0),
        0
      ) || 0;
      const deferredCount = Math.max(0, totalRestockableItemsCount - itemsInBasketCount);

      uniqueStrategies.push({
        ...s,
        friendlyName: meta.label,
        friendlyBadge: s.type === recommendedStrategy?.type ? 'Best value (recommended)' : meta.badge,
        friendlyDescription: meta.description,
        deferredCount: s.type === 'STRATEGY_D_DEFER_NON_URGENT' ? deferredCount : undefined,
      });
    }
  }

  // Max 3
  return uniqueStrategies.slice(0, 3);
}
