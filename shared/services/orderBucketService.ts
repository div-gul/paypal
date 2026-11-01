import {
  PantryItem,
  ProductSwapRequest,
  SimulationState,
  StoreProduct,
  UpcomingOrderBucket,
  UpcomingOrderItem,
  WeeklySchedulerConfig,
} from '../types';
import { MOCK_STORE_CATALOG } from '../adapters/mockStoreData';
import { getDaysUntilNextShoppingRun } from './restockScheduler';

/**
 * Parses package size string into numerical unit amount.
 */
export function parsePackSize(packageSize: string, itemUnit: string): number {
  const match = packageSize?.match(/^([\d.]+)\s*(\w+)?$/);
  if (!match) return 1;
  const parsedSize = parseFloat(match[1]);
  const parsedUnit = (match[2] || '').toLowerCase();
  const unit = (itemUnit || '').toLowerCase();
  if (!isNaN(parsedSize) && parsedSize > 0) {
    if (parsedUnit === unit || !parsedUnit || (unit === 'eggs' && parsedUnit.includes('pc'))) {
      return parsedSize;
    }
  }
  return 1;
}

export interface ComputeOrderBucketParams {
  pantryItems: PantryItem[];
  schedulerConfig: WeeklySchedulerConfig;
  simulationState: SimulationState;
  existingBucket: UpcomingOrderBucket | null;
  swapDecisions: Record<string, 'approved' | 'rejected'>;
  catalog?: StoreProduct[];
}

/**
 * Pure deterministic calculation of the Upcoming Weekly Order Bucket.
 * Automatically populates based on:
 * - Pantry stock levels
 * - Predicted consumption
 * - Replenishment requirements
 * - Existing shopping rules
 * - Approved product preferences
 * - Preserves user modifications when the user is reviewing the draft order
 * - Preserves an order while it is being reviewed
 */
export function computeUpcomingOrderBucket({
  pantryItems,
  schedulerConfig,
  simulationState,
  existingBucket,
  swapDecisions,
  catalog = MOCK_STORE_CATALOG,
}: ComputeOrderBucketParams): {
  bucket: UpcomingOrderBucket;
  pendingSwaps: ProductSwapRequest[];
} {
  const daysUntilNextRun = getDaysUntilNextShoppingRun(
    simulationState.simulatedDate,
    schedulerConfig.nextShoppingDate
  );

  const nextDateObj = new Date(schedulerConfig.nextShoppingDate);
  const cycleDayName = nextDateObj.toLocaleDateString('en-IN', { weekday: 'long' });
  const scheduledDate = nextDateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const existingItemsMap = new Map<string, UpcomingOrderItem>();
  if (existingBucket?.items) {
    for (const item of existingBucket.items) {
      existingItemsMap.set(item.pantryItemId, item);
    }
  }

  const items: UpcomingOrderItem[] = [];
  const pendingSwaps: ProductSwapRequest[] = [];

  for (const pantryItem of pantryItems) {
    const existing = existingItemsMap.get(pantryItem.id);

    // If user explicitly removed this item in their review, respect it unless simulation advances to emergency 0
    if (existing?.quantity === 0 && existing.isUserModified && pantryItem.currentQuantity > 0) {
      continue;
    }

    // 1. Forecast stock and replenishment needs
    const daysRemaining =
      pantryItem.averageDailyConsumption > 0
        ? pantryItem.currentQuantity / pantryItem.averageDailyConsumption
        : null;

    const projectedStockAtNextRun =
      pantryItem.currentQuantity - pantryItem.averageDailyConsumption * daysUntilNextRun;

    const isDepletedNow = pantryItem.currentQuantity <= 0;
    const runsOutBeforeRun = daysRemaining !== null && daysRemaining < daysUntilNextRun;
    const lowAtRun = projectedStockAtNextRun <= pantryItem.minStockThreshold;

    const needsRestock = isDepletedNow || runsOutBeforeRun || lowAtRun;

    // Check if user manually added or kept this item even if not strictly depleted
    const keepUserModified = existing && existing.isUserModified && existing.quantity > 0;

    if (!needsRestock && !keepUserModified) {
      continue;
    }

    // 2. Quantity calculations
    const packSize = parsePackSize(pantryItem.preferredPackageSize, pantryItem.unit);
    const deficit = Math.max(0, pantryItem.targetStock - Math.max(0, projectedStockAtNextRun));
    const suggestedQuantity = Math.max(1, Math.ceil(deficit / packSize));

    let activeQuantity = suggestedQuantity;
    let isUserModified = false;

    if (existing && existing.isUserModified) {
      // Preserve user modifications while under review!
      activeQuantity = existing.quantity;
      isUserModified = true;
    }

    // 3. Product & Brand matching
    const exactMatches = catalog.filter(
      p => p.pantryItemId === pantryItem.id && p.isExactBrandMatch && p.inStock
    );
    const substituteMatches = catalog.filter(
      p => p.pantryItemId === pantryItem.id && !p.isExactBrandMatch && p.inStock
    );

    const exactMatch = exactMatches[0] || catalog.find(p => p.pantryItemId === pantryItem.id);
    const substituteMatch = substituteMatches[0] || null;

    let chosenProduct = exactMatch || catalog[0];
    let originalProduct: StoreProduct | undefined = exactMatch;
    let isSubstitution = false;
    let swapStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none';
    let swapRequestId: string | undefined = undefined;

    // Check if a product swap is suggested (e.g. Zepto substitution or preferred brand unavailable)
    if (substituteMatch && pantryItem.allowSubstitutions) {
      const userDecision = swapDecisions[pantryItem.id];

      if (userDecision === 'approved') {
        chosenProduct = substituteMatch;
        isSubstitution = true;
        swapStatus = 'approved';
      } else if (userDecision === 'rejected') {
        chosenProduct = exactMatch || substituteMatch;
        isSubstitution = false;
        swapStatus = 'rejected';
      } else {
        // Pending swap:
        // Rule: Never apply a suggested replacement automatically.
        // Only apply the replacement after explicit approval.
        // On rejection, retain the original product in the shopping plan.
        // Keep pending swap requests in the Approvals section.
        chosenProduct = exactMatch || substituteMatch;
        isSubstitution = false;
        swapStatus = 'pending';
        swapRequestId = `swap-${pantryItem.id}`;

        const origPrice = exactMatch ? exactMatch.pricePaise : substituteMatch.pricePaise;
        const subPrice = substituteMatch.pricePaise;
        const diffPaise = subPrice - origPrice;

        pendingSwaps.push({
          id: swapRequestId,
          pantryItemId: pantryItem.id,
          itemName: pantryItem.name,
          originalProduct: exactMatch || substituteMatch,
          replacementProduct: substituteMatch,
          packageSize: substituteMatch.packageSize,
          quantity: activeQuantity,
          originalPricePaise: origPrice,
          replacementPricePaise: subPrice,
          priceDifferencePaise: diffPaise,
          reason: diffPaise < 0
            ? `Consolidated store discount: ${substituteMatch.brand} saves ₹${Math.abs(diffPaise) / 100} over ${pantryItem.preferredBrand}.`
            : `Preferred brand ${pantryItem.preferredBrand} out of stock at store; ${substituteMatch.brand} is in-stock.`,
          status: 'pending',
        });
      }
    }

    const unitPricePaise = chosenProduct.pricePaise;
    const totalPricePaise = activeQuantity * unitPricePaise;

    items.push({
      id: pantryItem.id,
      pantryItemId: pantryItem.id,
      itemName: pantryItem.name,
      category: pantryItem.category,
      product: chosenProduct,
      originalProduct,
      packageSize: pantryItem.preferredPackageSize,
      unit: pantryItem.unit,
      suggestedQuantity,
      quantity: activeQuantity,
      isUserModified,
      unitPricePaise,
      totalPricePaise,
      isSubstitution,
      swapRequestId,
      swapStatus,
    });
  }

  // Calculate totals
  const subtotalPaise = items.reduce((sum, item) => sum + item.totalPricePaise, 0);
  const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  const bucket: UpcomingOrderBucket = {
    id: existingBucket?.id || `upcoming-order-${Date.now()}`,
    scheduledDate,
    cycleDayName,
    items,
    status: 'draft',
    savedAt: existingBucket?.savedAt,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise,
  };

  return { bucket, pendingSwaps };
}

/**
 * Instant in-memory quantity updater for upcoming order item.
 * 0ms lag, updates line total, subtotal, and grand total synchronously.
 */
export function updateOrderItemQuantity(
  bucket: UpcomingOrderBucket,
  itemId: string,
  delta: number
): UpcomingOrderBucket {
  const updatedItems = bucket.items.map(item => {
    if (item.id === itemId || item.pantryItemId === itemId) {
      const newQty = Math.max(1, item.quantity + delta);
      const newTotal = newQty * item.unitPricePaise;
      return {
        ...item,
        quantity: newQty,
        isUserModified: true,
        totalPricePaise: newTotal,
      };
    }
    return item;
  });

  const subtotalPaise = updatedItems.reduce((sum, item) => sum + item.totalPricePaise, 0);
  const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  return {
    ...bucket,
    items: updatedItems,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise,
  };
}

/**
 * Instant in-memory item removal from upcoming order.
 */
export function removeOrderItem(
  bucket: UpcomingOrderBucket,
  itemId: string
): UpcomingOrderBucket {
  const updatedItems = bucket.items.filter(
    item => item.id !== itemId && item.pantryItemId !== itemId
  );

  const subtotalPaise = updatedItems.reduce((sum, item) => sum + item.totalPricePaise, 0);
  const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  return {
    ...bucket,
    items: updatedItems,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise,
  };
}

/**
 * Instant in-memory product addition to upcoming order.
 */
export function addOrderItem(
  bucket: UpcomingOrderBucket,
  pantryItem: PantryItem,
  catalog = MOCK_STORE_CATALOG
): UpcomingOrderBucket {
  const existing = bucket.items.find(i => i.pantryItemId === pantryItem.id);
  if (existing) {
    return updateOrderItemQuantity(bucket, pantryItem.id, 1);
  }

  const match = catalog.find(p => p.pantryItemId === pantryItem.id && p.inStock) || catalog[0];
  const unitPricePaise = match.pricePaise;
  const quantity = 1;
  const totalPricePaise = quantity * unitPricePaise;

  const newItem: UpcomingOrderItem = {
    id: pantryItem.id,
    pantryItemId: pantryItem.id,
    itemName: pantryItem.name,
    category: pantryItem.category,
    product: match,
    originalProduct: match,
    packageSize: pantryItem.preferredPackageSize,
    unit: pantryItem.unit,
    suggestedQuantity: 1,
    quantity: 1,
    isUserModified: true,
    unitPricePaise,
    totalPricePaise,
    isSubstitution: false,
    swapStatus: 'none',
  };

  const updatedItems = [...bucket.items, newItem];
  const subtotalPaise = updatedItems.reduce((sum, item) => sum + item.totalPricePaise, 0);
  const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  return {
    ...bucket,
    items: updatedItems,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise,
  };
}

/**
 * Instant order approval confirmation.
 */
export function approveOrder(bucket: UpcomingOrderBucket): UpcomingOrderBucket {
  return {
    ...bucket,
    status: 'approved',
    approvedAt: new Date().toISOString(),
  };
}
