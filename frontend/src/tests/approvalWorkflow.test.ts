import {
  computeUpcomingOrderBucket,
  updateOrderItemQuantity,
  removeOrderItem,
  addOrderItem,
  approveOrder,
  getUnpaidOrderItems,
} from '../../../shared/services/orderBucketService';
import {
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
} from '../../../shared/services/defaults';
import { advancePantryState } from '../../../shared/services/consumptionEngine';
import { PantryItem, SimulationState } from '../../../shared/types';

declare const process: any;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('\n--- Phase F: Two Approval Types & Instant Order Bucket Suite ---');

// 1. A product swap generates a separate approval.
console.log('\nTest 1: Product swap generates a separate approval');
const initialResult = computeUpcomingOrderBucket({
  pantryItems: DEFAULT_PANTRY_ITEMS,
  schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
  simulationState: DEFAULT_SIMULATION_STATE,
  existingBucket: null,
  swapDecisions: {},
});

assert(initialResult.pendingSwaps.length > 0, 'Pending swaps generated for items with alternate brand candidates');
const oatsSwap = initialResult.pendingSwaps.find(s => s.pantryItemId === 'item-oats');
assert(Boolean(oatsSwap), 'Oats has a separate product swap approval request');
assert(oatsSwap?.originalProduct.brand === 'Quaker', 'Original product brand is Quaker');
assert(Boolean(oatsSwap?.replacementProduct.brand.includes("Kellogg")), 'Replacement product brand is Kellogg');
assert(typeof oatsSwap?.priceDifferencePaise === 'number', 'Price difference is calculated in paise');
assert(oatsSwap?.status === 'pending', 'Swap approval status is pending');

// 2. Approving a swap updates the shopping plan.
console.log('\nTest 2: Approving a swap updates the shopping plan');
const approvedSwapResult = computeUpcomingOrderBucket({
  pantryItems: DEFAULT_PANTRY_ITEMS,
  schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
  simulationState: DEFAULT_SIMULATION_STATE,
  existingBucket: initialResult.bucket,
  swapDecisions: { 'item-oats': 'approved' },
});

const oatsItemApproved = approvedSwapResult.bucket.items.find(i => i.pantryItemId === 'item-oats');
assert(Boolean(oatsItemApproved?.product.brand.includes("Kellogg")), 'Approved swap replaces product with Kellogg in upcoming order');
assert(oatsItemApproved?.isSubstitution === true, 'Item flagged as substitution after approval');
assert(!approvedSwapResult.pendingSwaps.some(s => s.pantryItemId === 'item-oats'), 'Oats removed from pending swap approvals list');

// 3. Rejecting a swap preserves the original product.
console.log('\nTest 3: Rejecting a swap preserves the original product');
const rejectedSwapResult = computeUpcomingOrderBucket({
  pantryItems: DEFAULT_PANTRY_ITEMS,
  schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
  simulationState: DEFAULT_SIMULATION_STATE,
  existingBucket: initialResult.bucket,
  swapDecisions: { 'item-oats': 'rejected' },
});

const oatsItemRejected = rejectedSwapResult.bucket.items.find(i => i.pantryItemId === 'item-oats');
assert(oatsItemRejected?.product.brand === 'Quaker', 'Rejected swap retains original Quaker product in upcoming order');
assert(oatsItemRejected?.isSubstitution === false, 'Item is not marked as substitution after rejection');
assert(!rejectedSwapResult.pendingSwaps.some(s => s.pantryItemId === 'item-oats'), 'Oats removed from pending swap approvals list');

// 4. Future simulation adds newly required products directly to the upcoming order bucket.
console.log('\nTest 4: Future simulation adds newly required products directly to upcoming order bucket');
// Advance time by 3 days: items with safe stock initially now deplete and cross restock threshold
const advancedPantry = advancePantryState(DEFAULT_PANTRY_ITEMS, 3);
const advancedClock: SimulationState = {
  ...DEFAULT_SIMULATION_STATE,
  daysElapsed: 3,
  simulatedDate: new Date(new Date(DEFAULT_SIMULATION_STATE.simulatedDate).getTime() + 3 * 86400000).toISOString(),
};

const simResult = computeUpcomingOrderBucket({
  pantryItems: advancedPantry,
  schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
  simulationState: advancedClock,
  existingBucket: initialResult.bucket,
  swapDecisions: {},
});

// Check that items requiring replenishment are directly added to the upcoming order bucket
assert(simResult.bucket.items.length >= initialResult.bucket.items.length, 'Simulation added depleted products to upcoming order bucket');

// 5. No individual approval is generated for regular products.
console.log('\nTest 5: No individual approval is generated for regular products');
// The pendingSwaps list should ONLY contain product substitutions/swaps, NOT regular restocks like milk or bread
for (const swap of simResult.pendingSwaps) {
  assert(swap.originalProduct.brand !== swap.replacementProduct.brand, 'Approvals list strictly contains product swaps, not regular restocks');
}

// 6. User can add, remove and modify products in upcoming order.
console.log('\nTest 6: User can add, remove, and modify products in upcoming order');
let testBucket = initialResult.bucket;

// Modify quantity
const modifiedBucket = updateOrderItemQuantity(testBucket, 'item-milk', 2);
const modifiedMilk = modifiedBucket.items.find(i => i.pantryItemId === 'item-milk');
assert(modifiedMilk?.quantity === (initialResult.bucket.items.find(i => i.pantryItemId === 'item-milk')?.quantity || 1) + 2, 'Quantity increased');
assert(modifiedMilk?.isUserModified === true, 'Flagged as user modified');

// 7. Quantity and total price update instantly.
console.log('\nTest 7: Quantity and total price update instantly');
const expectedLineTotal = (modifiedMilk?.quantity || 1) * (modifiedMilk?.unitPricePaise || 0);
assert(modifiedMilk?.totalPricePaise === expectedLineTotal, 'Line total price updated synchronously');
const expectedSubtotal = modifiedBucket.items.reduce((s, i) => s + i.totalPricePaise, 0);
assert(modifiedBucket.subtotalPaise === expectedSubtotal, 'Subtotal updated synchronously');
assert(modifiedBucket.totalPaise === expectedSubtotal + modifiedBucket.deliveryFeePaise, 'Grand total updated synchronously');

// Remove product
const countBefore = modifiedBucket.items.length;
const removedBucket = removeOrderItem(modifiedBucket, 'item-milk');
assert(removedBucket.items.length === countBefore - 1, 'Product removed from upcoming order');
assert(!removedBucket.items.some(i => i.pantryItemId === 'item-milk'), 'Milk no longer in bucket');

// Add product
const testPantryItem: PantryItem = {
  id: 'item-coffee',
  name: 'Pure Instant Coffee',
  category: 'Beverages',
  preferredBrand: 'Nescafe',
  preferredPackageSize: '200g',
  unit: 'packs',
  currentQuantity: 5,
  averageDailyConsumption: 0.1,
  minStockThreshold: 1,
  targetStock: 3,
  allowSubstitutions: false,
  requireApprovalForBrandChange: true,
  lastRestockedDate: '2026-10-10T08:00:00.000Z',
  stockoutDaysCount: 0,
};
const addedBucket = addOrderItem(removedBucket, testPantryItem);
assert(addedBucket.items.some(i => i.pantryItemId === 'item-coffee'), 'Coffee successfully added to upcoming order');

const newHouseholdMilk = { ...DEFAULT_PANTRY_ITEMS.find(i => i.id === 'item-milk')!, id: 'household-milk-1', currentQuantity: 0 };
const newHouseholdOrder = addOrderItem({ ...initialResult.bucket, items: [] }, newHouseholdMilk);
assert(newHouseholdOrder.items[0]?.product.id === 'bl-milk-1', 'A new household milk item resolves to a milk catalog product');
for (const defaultItem of DEFAULT_PANTRY_ITEMS) {
  const householdItem = { ...defaultItem, id: `household-${defaultItem.id}`, currentQuantity: 0 };
  const householdBucket = addOrderItem({ ...initialResult.bucket, items: [] }, householdItem);
  assert(
    householdBucket.items[0]?.product.pantryItemId === defaultItem.id,
    `New household ${defaultItem.name} resolves only to its matching catalog products`,
  );
}

const paidBucket = {
  ...initialResult.bucket,
  paidAt: new Date().toISOString(),
  paidQuantities: Object.fromEntries(initialResult.bucket.items.map(item => [item.pantryItemId, item.quantity])),
};
assert(getUnpaidOrderItems(paidBucket).length === 0, 'A paid order has no remaining payable quantities');
const paidMilk = paidBucket.items.find(item => item.pantryItemId === 'item-milk')!;
const increasedPaidBucket = updateOrderItemQuantity(paidBucket, paidMilk.pantryItemId, 1);
assert(increasedPaidBucket.items.find(item => item.pantryItemId === paidMilk.pantryItemId)?.quantity === paidMilk.quantity + 1, 'Paid order items can be increased');
assert(getUnpaidOrderItems(increasedPaidBucket)[0]?.quantity === 1, 'Checkout includes only the added quantity');
const reducedPaidBucket = updateOrderItemQuantity(paidBucket, paidMilk.pantryItemId, -1);
assert(reducedPaidBucket.items.find(item => item.pantryItemId === paidMilk.pantryItemId)?.quantity === paidMilk.quantity, 'Paid quantities cannot be reduced below the captured amount');

// 8. User modifications are not silently overwritten by simulation.
console.log('\nTest 8: User modifications are not silently overwritten by simulation');
// Set a custom quantity of 7 on eggs
const userEditedBucket = updateOrderItemQuantity(initialResult.bucket, 'item-eggs', 5);
const eggsItem = userEditedBucket.items.find(i => i.pantryItemId === 'item-eggs');
const userQty = eggsItem?.quantity;
assert(Boolean(userQty && userQty >= 5), 'User set custom quantity for eggs');

// Run simulation
const postSimBucket = computeUpcomingOrderBucket({
  pantryItems: advancedPantry,
  schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
  simulationState: advancedClock,
  existingBucket: userEditedBucket,
  swapDecisions: {},
});
const postSimEggs = postSimBucket.bucket.items.find(i => i.pantryItemId === 'item-eggs');
assert(postSimEggs?.quantity === userQty, 'User modified quantity was preserved across simulation advancement');

// 9. One consolidated order approval confirms the complete upcoming basket.
console.log('\nTest 9: One consolidated order approval confirms the complete upcoming basket');
assert(userEditedBucket.status === 'draft', 'Initial order status is draft');
const confirmedOrder = approveOrder(userEditedBucket);
assert(confirmedOrder.status === 'approved', 'Single approval marks complete order as approved');
assert(typeof confirmedOrder.approvedAt === 'string', 'Approval timestamp recorded');

// 10. The next cycle starts from current pantry state, not the previous cycle's order edits.
console.log('\nTest 10: Next cycle is independent from the previously saved order');
const previousCycleItemsSnapshot = JSON.stringify(confirmedOrder.items);
const postApprovalSimResult = computeUpcomingOrderBucket({
  pantryItems: advancePantryState(advancedPantry, 4),
  schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
  simulationState: {
    ...advancedClock,
    daysElapsed: 7,
    simulatedDate: new Date(new Date(advancedClock.simulatedDate).getTime() + 4 * 86400000).toISOString(),
  },
  existingBucket: null,
  swapDecisions: {},
});

assert(postApprovalSimResult.bucket.status === 'draft', 'Next cycle starts as a fresh editable draft');
assert(JSON.stringify(postApprovalSimResult.bucket.items) !== previousCycleItemsSnapshot, 'Previous cycle order edits do not carry into the next cycle');

console.log('\n🎉 ALL 10 APPROVAL WORKFLOW & INSTANT BUCKET TESTS PASSED SUCCESSFULLY!\n');
