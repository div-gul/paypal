import {
  BasketItem,
  BasketStrategyResult,
  BasketStrategyType,
  PantryItem,
  RestockRecommendation,
  StoreId,
  StoreProduct,
  StoreSubBasket,
} from '../types';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { STORE_DEFINITIONS, MOCK_STORE_CATALOG } from '../adapters/mockStoreData';
import { formatPaise } from './currency';

export interface OptimizerContext {
  recommendations: RestockRecommendation[];
  pantryItems: PantryItem[];
}

/**
 * Builds a StoreSubBasket with correct independent store-level fee calculations
 */
function buildStoreSubBasket(storeId: StoreId, items: BasketItem[]): StoreSubBasket {
  const adapter = AdapterRegistry.getAdapter(storeId);
  const storeInfo = STORE_DEFINITIONS[storeId];

  const productSubtotalPaise = items.reduce((acc, curr) => acc + curr.totalPaise, 0);
  const fees = adapter.calculateStoreFees(productSubtotalPaise);

  const totalPaise = productSubtotalPaise + fees.totalFeesPaise;
  const meetsMinOrder = productSubtotalPaise >= storeInfo.minOrderThresholdPaise;

  return {
    storeId,
    storeName: storeInfo.name,
    items,
    productSubtotalPaise,
    deliveryFeePaise: fees.deliveryFeePaise,
    handlingFeePaise: fees.handlingFeePaise,
    taxPaise: fees.taxPaise,
    discountsPaise: 0,
    minOrderShortfallPaise: fees.minOrderShortfallPaise,
    totalPaise,
    meetsMinOrder,
    minOrderThresholdPaise: storeInfo.minOrderThresholdPaise,
  };
}

/**
 * Consolidates a set of StoreSubBaskets into a BasketStrategyResult
 */
function createStrategyResult(
  type: BasketStrategyType,
  title: string,
  tag: string,
  description: string,
  storeBaskets: StoreSubBasket[]
): BasketStrategyResult {
  const activeBaskets = storeBaskets.filter(b => b.items.length > 0);

  const totalProductPaise = activeBaskets.reduce((acc, b) => acc + b.productSubtotalPaise, 0);
  const totalDeliveryFeePaise = activeBaskets.reduce((acc, b) => acc + b.deliveryFeePaise, 0);
  const totalHandlingFeePaise = activeBaskets.reduce((acc, b) => acc + b.handlingFeePaise, 0);
  const totalTaxPaise = activeBaskets.reduce((acc, b) => acc + b.taxPaise, 0);
  const totalDiscountPaise = activeBaskets.reduce((acc, b) => acc + b.discountsPaise, 0);
  const grandTotalPaise = activeBaskets.reduce((acc, b) => acc + b.totalPaise, 0);

  return {
    type,
    title,
    tag,
    description,
    storeBaskets: activeBaskets,
    totalProductPaise,
    totalDeliveryFeePaise,
    totalHandlingFeePaise,
    totalTaxPaise,
    totalDiscountPaise,
    grandTotalPaise,
    isRecommended: false,
    recommendationReason: '',
    storesInvolvedCount: activeBaskets.length,
  };
}

/**
 * Finds all store offerings for an item
 */
function getStoreOfferingsForItem(item: PantryItem): Map<StoreId, StoreProduct> {
  const offerings = new Map<StoreId, StoreProduct>();
  const candidates = MOCK_STORE_CATALOG.filter(p => p.pantryItemId === item.id && p.inStock);

  for (const storeId of AdapterRegistry.getStoreIds()) {
    const storeCandidates = candidates.filter(p => p.storeId === storeId);
    if (storeCandidates.length > 0) {
      // Prefer exact brand match
      const exact = storeCandidates.find(p => p.brand.toLowerCase() === item.preferredBrand.toLowerCase());
      if (exact) {
        offerings.set(storeId, exact);
      } else if (item.allowSubstitutions) {
        offerings.set(storeId, storeCandidates[0]);
      }
    }
  }

  return offerings;
}

/**
 * Delivery-Fee-Aware Basket Optimizer
 */
export function optimizeBaskets(context: OptimizerContext): {
  strategies: BasketStrategyResult[];
  recommendedStrategy: BasketStrategyResult;
} {
  const { recommendations, pantryItems } = context;

  // Items to restock: everything except BLOCKED or WAIT_UNTIL_NEXT_CYCLE
  const itemsToRestock = recommendations.filter(
    r => (r.outcome === 'RESTOCK_NOW' || r.outcome === 'INCLUDE_IN_WEEKLY_BASKET' || r.outcome === 'ASK_FOR_APPROVAL' || r.approvalStatus === 'approved') &&
         r.recommendedQuantity > 0
  );

  if (itemsToRestock.length === 0) {
    // Empty basket scenario
    const emptyResult = createStrategyResult(
      'STRATEGY_B_SINGLE_STORE',
      'Consolidated Order',
      'No restock required',
      'Your pantry is adequately stocked until the next scheduled shopping cycle.',
      []
    );
    emptyResult.isRecommended = true;
    emptyResult.recommendationReason = 'All items are currently at safe stock levels. No purchases needed.';
    return { strategies: [emptyResult], recommendedStrategy: emptyResult };
  }

  const pantryMap = new Map(pantryItems.map(p => [p.id, p]));

  // ==========================================
  // STRATEGY A: Item-Level Lowest Price (Greedy)
  // ==========================================
  const storeGroupsA = new Map<StoreId, BasketItem[]>();
  for (const id of AdapterRegistry.getStoreIds()) {
    storeGroupsA.set(id, []);
  }

  for (const rec of itemsToRestock) {
    const item = pantryMap.get(rec.itemId);
    if (!item) continue;

    const offerings = getStoreOfferingsForItem(item);
    if (offerings.size === 0) continue;

    // Pick strictly lowest unit price
    let bestStore: StoreId | null = null;
    let lowestPrice = Infinity;
    let bestProduct: StoreProduct | null = null;

    offerings.forEach((prod, storeId) => {
      if (prod.pricePaise < lowestPrice) {
        lowestPrice = prod.pricePaise;
        bestStore = storeId;
        bestProduct = prod;
      }
    });

    if (bestStore && bestProduct) {
      storeGroupsA.get(bestStore)!.push({
        product: bestProduct,
        pantryItemId: item.id,
        quantity: rec.recommendedQuantity,
        totalPaise: (bestProduct as StoreProduct).pricePaise * rec.recommendedQuantity,
        isSubstitution: !(bestProduct as StoreProduct).isExactBrandMatch,
      });
    }
  }

  const subBasketsA: StoreSubBasket[] = [];
  storeGroupsA.forEach((items, storeId) => {
    if (items.length > 0) {
      subBasketsA.push(buildStoreSubBasket(storeId, items));
    }
  });

  const strategyA = createStrategyResult(
    'STRATEGY_A_LOWEST_PRICE',
    'Strategy A: Lowest Product Price (Multi-Store)',
    'Split Across Stores',
    'Selects the cheapest unit price for each item individually, splitting orders across stores.',
    subBasketsA
  );

  // ==========================================
  // STRATEGY B: Single Store Consolidation
  // ==========================================
  const singleStoreCandidates: { storeId: StoreId; subBasket: StoreSubBasket; coverageCount: number }[] = [];

  for (const storeId of AdapterRegistry.getStoreIds()) {
    const itemsB: BasketItem[] = [];

    for (const rec of itemsToRestock) {
      const item = pantryMap.get(rec.itemId);
      if (!item) continue;

      const offerings = getStoreOfferingsForItem(item);
      const prod = offerings.get(storeId);

      if (prod) {
        itemsB.push({
          product: prod,
          pantryItemId: item.id,
          quantity: rec.recommendedQuantity,
          totalPaise: prod.pricePaise * rec.recommendedQuantity,
          isSubstitution: !prod.isExactBrandMatch,
        });
      }
    }

    if (itemsB.length > 0) {
      const sub = buildStoreSubBasket(storeId, itemsB);
      singleStoreCandidates.push({
        storeId,
        subBasket: sub,
        coverageCount: itemsB.length,
      });
    }
  }

  // Pick single store with best total price (prioritizing full coverage)
  singleStoreCandidates.sort((a, b) => {
    if (a.coverageCount !== b.coverageCount) {
      return b.coverageCount - a.coverageCount; // max coverage
    }
    return a.subBasket.totalPaise - b.subBasket.totalPaise;
  });

  const bestSingle = singleStoreCandidates[0] || null;
  const subBasketsB = bestSingle ? [bestSingle.subBasket] : [];

  const strategyB = createStrategyResult(
    'STRATEGY_B_SINGLE_STORE',
    'Strategy B: Single Store Consolidation',
    'Consolidated Delivery',
    `Bundles all restocking items into a single store order (${bestSingle ? bestSingle.subBasket.storeName : 'Consolidated'}) to avoid paying multiple delivery and platform fees.`,
    subBasketsB
  );

  // ==========================================
  // STRATEGY C: Smart Multi-Store Split
  // ==========================================
  // Start with best single store, and only split an item to another store if:
  // (Price savings on that item) > (New store deliveryFee + handlingFee + tax)
  const strategyCItems = new Map<StoreId, BasketItem[]>();
  for (const id of AdapterRegistry.getStoreIds()) {
    strategyCItems.set(id, []);
  }

  if (bestSingle) {
    const primaryStoreId = bestSingle.storeId;

    for (const rec of itemsToRestock) {
      const item = pantryMap.get(rec.itemId);
      if (!item) continue;

      const offerings = getStoreOfferingsForItem(item);
      const primaryProd = offerings.get(primaryStoreId);

      // Check if another store has a massive discount that justifies paying a second delivery fee
      let bestAlternateStore: StoreId | null = null;
      let maxNetSavings = 0;
      let alternateProd: StoreProduct | null = null;

      offerings.forEach((prod, altStoreId) => {
        if (altStoreId !== primaryStoreId && primaryProd) {
          const itemSavings = (primaryProd.pricePaise - prod.pricePaise) * rec.recommendedQuantity;
          const altStoreInfo = STORE_DEFINITIONS[altStoreId];
          const overhead = altStoreInfo.deliveryFeeBasePaise + altStoreInfo.handlingFeePaise;

          // Only justify if savings beat overhead
          if (itemSavings - overhead > maxNetSavings) {
            maxNetSavings = itemSavings - overhead;
            bestAlternateStore = altStoreId;
            alternateProd = prod;
          }
        }
      });

      if (bestAlternateStore && alternateProd && maxNetSavings > 500) { // ₹5+ net savings
        strategyCItems.get(bestAlternateStore)!.push({
          product: alternateProd,
          pantryItemId: item.id,
          quantity: rec.recommendedQuantity,
          totalPaise: (alternateProd as StoreProduct).pricePaise * rec.recommendedQuantity,
          isSubstitution: !(alternateProd as StoreProduct).isExactBrandMatch,
        });
      } else if (primaryProd) {
        strategyCItems.get(primaryStoreId)!.push({
          product: primaryProd,
          pantryItemId: item.id,
          quantity: rec.recommendedQuantity,
          totalPaise: primaryProd.pricePaise * rec.recommendedQuantity,
          isSubstitution: !primaryProd.isExactBrandMatch,
        });
      }
    }
  }

  const subBasketsC: StoreSubBasket[] = [];
  strategyCItems.forEach((items, storeId) => {
    if (items.length > 0) {
      subBasketsC.push(buildStoreSubBasket(storeId, items));
    }
  });

  const strategyC = createStrategyResult(
    'STRATEGY_C_SMART_SPLIT',
    'Strategy C: Smart Fee-Justified Split',
    'Selective Multi-Store',
    'Splits items across stores only when product price discounts exceed the secondary store’s delivery and handling fees.',
    subBasketsC.length > 0 ? subBasketsC : subBasketsB
  );

  // ==========================================
  // STRATEGY D: Defer Non-Urgent Items
  // ==========================================
  // Restocks ONLY urgent items (items likely to run out before next run or stockout)
  const urgentRecs = itemsToRestock.filter(r => r.isUrgent);
  const subBasketsD: StoreSubBasket[] = [];

  if (urgentRecs.length > 0) {
    // Find best single store for urgent items
    const urgentItemsD: BasketItem[] = [];
    const urgentTargetStore = bestSingle ? bestSingle.storeId : 'zepto';

    for (const rec of urgentRecs) {
      const item = pantryMap.get(rec.itemId);
      if (!item) continue;
      const offerings = getStoreOfferingsForItem(item);
      const prod = offerings.get(urgentTargetStore) || Array.from(offerings.values())[0];
      if (prod) {
        urgentItemsD.push({
          product: prod,
          pantryItemId: item.id,
          quantity: rec.recommendedQuantity,
          totalPaise: prod.pricePaise * rec.recommendedQuantity,
          isSubstitution: !prod.isExactBrandMatch,
        });
      }
    }

    if (urgentItemsD.length > 0) {
      subBasketsD.push(buildStoreSubBasket(urgentTargetStore, urgentItemsD));
    }
  }

  const strategyD = createStrategyResult(
    'STRATEGY_D_DEFER_NON_URGENT',
    'Strategy D: Defer Non-Urgent to Weekly Cycle',
    'Emergency Only',
    `Orders only critical items running out before the weekly run (${urgentRecs.length} item${urgentRecs.length === 1 ? '' : 's'}), deferring safe items to save upfront expenditure.`,
    subBasketsD
  );

  const strategies: BasketStrategyResult[] = [strategyB, strategyA, strategyC, strategyD];

  // ==========================================
  // RECOMMENDATION EVALUATION
  // ==========================================
  // Compare Strategy A vs Strategy B:
  // Is Strategy B cheaper than Strategy A because of multi-store delivery charges?
  const diffPaise = strategyA.grandTotalPaise - strategyB.grandTotalPaise;

  if (strategyB.storeBaskets.length > 0 && strategyB.grandTotalPaise <= strategyA.grandTotalPaise) {
    strategyB.isRecommended = true;
    if (diffPaise > 0) {
      strategyB.recommendationReason = `Buying items separately from ${strategyA.storesInvolvedCount} stores would cost ${formatPaise(
        diffPaise
      )} more in combined delivery and platform fees. We recommend purchasing all items consolidated from ${
        strategyB.storeBaskets[0].storeName
      }.`;
    } else {
      strategyB.recommendationReason = `Consolidating your order with ${strategyB.storeBaskets[0].storeName} achieves the lowest total payable cost with a single delivery.`;
    }
    return { strategies, recommendedStrategy: strategyB };
  } else if (strategyC.grandTotalPaise < strategyB.grandTotalPaise && strategyC.storeBaskets.length > 1) {
    strategyC.isRecommended = true;
    strategyC.recommendationReason = `Splitting items between ${strategyC.storeBaskets.map(b => b.storeName).join(' and ')} produces net savings of ${formatPaise(
      strategyB.grandTotalPaise - strategyC.grandTotalPaise
    )}, even after accounting for separate delivery and handling fees.`;
    return { strategies, recommendedStrategy: strategyC };
  } else {
    strategyA.isRecommended = true;
    strategyA.recommendationReason = `Multi-store price discounts surpass the combined delivery charges by ${formatPaise(
      Math.abs(diffPaise)
    )}.`;
    return { strategies, recommendedStrategy: strategyA };
  }
}
