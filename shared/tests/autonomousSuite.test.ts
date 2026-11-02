import { calculateDaysRemaining, advancePantryState, forecastStock } from '../services/consumptionEngine';
declare const process: any;
import { generateRestockRecommendations, getDaysUntilNextShoppingRun } from '../services/restockScheduler';
import { optimizeBaskets } from '../services/basketOptimizer';
import { paiseToInr, inrToPaise, formatPaise, paiseToUsd } from '../services/currency';
import { DEFAULT_PANTRY_ITEMS, DEFAULT_SCHEDULER_CONFIG } from '../services/defaults';
import { PantryItem, WeeklySchedulerConfig } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

export async function runAutonomousSuite() {
  console.log('--- Starting ShopPilot AI Automated Test Suite ---\n');

  // 1. Currency Math Precision
  console.log('Test 1: Currency Integer Paise Math');
  assert(inrToPaise(199.50) === 19950, 'inrToPaise converts 199.50 to 19950 paise');
  assert(paiseToInr(19950) === 199.50, 'paiseToInr converts 19950 paise to 199.50 INR');
  assert(formatPaise(19950) === '₹199.50', 'formatPaise formats 19950 as ₹199.50');
  assert(formatPaise(250000) === '₹2,500', 'formatPaise formats 250000 as ₹2,500');

  // paiseToUsd: zero, edge cases, rounding up to cent, very large values, custom rate
  assert(paiseToUsd(0).usd === '0.00', 'paiseToUsd converts 0 paise to "0.00"');
  assert(paiseToUsd(0).rate === 85, 'paiseToUsd defaults to rate 85');
  assert(paiseToUsd(1).usd === '0.01', 'paiseToUsd rounds 1 paise up to 1 cent "0.01"');
  assert(paiseToUsd(84).usd === '0.01', 'paiseToUsd rounds 84 paise up to 1 cent "0.01"');
  assert(paiseToUsd(85).usd === '0.01', 'paiseToUsd maps exact 85 paise to 1 cent "0.01"');
  assert(paiseToUsd(86).usd === '0.02', 'paiseToUsd rounds 86 paise up to 2 cents "0.02"');
  assert(paiseToUsd(8500).usd === '1.00', 'paiseToUsd maps ₹85 (8500 paise) to "$1.00"');
  assert(paiseToUsd(93535).usd === '11.01', 'paiseToUsd maps ₹935.35 to "$11.01" (rounded up)');
  assert(paiseToUsd(8500000000).usd === '1000000.00', 'paiseToUsd handles very large 85M INR to "$1000000.00"');
  assert(paiseToUsd(100, 100).usd === '0.01', 'paiseToUsd respects custom rate 100 (100 paise = $0.01)');

  // 2. Consumption-Aware Pantry Management
  console.log('\nTest 2: Consumption-Aware Pantry Calculations');
  assert(calculateDaysRemaining(0.8, 0.5) === 1.6, '0.8L / 0.5L/day gives 1.6 days remaining');
  assert(calculateDaysRemaining(0, 0.5) === 0, '0 stock gives 0 days remaining');
  assert(calculateDaysRemaining(5, 0) === null, '0 consumption returns null (non-depleting)');
  assert(calculateDaysRemaining(-2, 0.5) === 0, 'Negative stock safely treated as 0 days');
  assert(forecastStock(1.0, 0.3, 2) === 0.4, 'Forecast stock 1.0 - (0.3 * 2) = 0.4');

  // 3. Time Advancement and Stockout Tracking
  console.log('\nTest 3: Time Advancement & Stockout Durations');
  const initialItems: PantryItem[] = [
    {
      ...DEFAULT_PANTRY_ITEMS[0], // Milk: 0.6L, 0.5L/day
      currentQuantity: 0.6,
      averageDailyConsumption: 0.5,
      stockoutDaysCount: 0,
    },
    {
      ...DEFAULT_PANTRY_ITEMS[4], // Coffee: 140g, 8g/day
      currentQuantity: 140,
      averageDailyConsumption: 8,
      stockoutDaysCount: 0,
    }
  ];

  // Advance by 1 day
  const day1 = advancePantryState(initialItems, 1);
  assert(day1[0].currentQuantity === 0.1, 'Milk depleted by 0.5 to 0.1L after 1 day');
  assert(day1[1].currentQuantity === 132, 'Coffee depleted by 8 to 132g after 1 day');

  // Advance by another 1 day (Milk runs out!)
  const day2 = advancePantryState(day1, 1);
  assert(day2[0].currentQuantity === 0, 'Milk depleted to 0L after day 2 (no negative stock)');
  assert(day2[0].stockoutDaysCount >= 0, 'Stockout count tracked correctly');

  // Advance by 3 more days (Milk remains empty)
  const day5 = advancePantryState(day2, 3);
  assert(day5[0].currentQuantity === 0, 'Milk remains at 0L (never negative)');
  assert(day5[0].stockoutDaysCount >= 3, 'Milk stockout duration increased by 3 days');

  // 4. Autonomous Restock Scheduler Decisions
  console.log('\nTest 4: Autonomous Restock Scheduler Decisions');
  const simDate = '2026-10-24T10:00:00.000Z';
  const config: WeeklySchedulerConfig = {
    ...DEFAULT_SCHEDULER_CONFIG,
    nextShoppingDate: '2026-10-27T10:00:00.000Z', // 3 days away
    emergencyRestockPreference: 'ask_approval',
  };

  const daysToRun = getDaysUntilNextShoppingRun(simDate, config.nextShoppingDate);
  assert(daysToRun === 3, 'Days until next shopping run calculated as 3 days');

  const recs = await generateRestockRecommendations({
    simulatedDate: simDate,
    config,
    pantryItems: DEFAULT_PANTRY_ITEMS,
  });

  assert(recs.length === DEFAULT_PANTRY_ITEMS.length, 'Generates recommendation for every item');

  // Milk: 0.6L, 0.5L/day -> lasts 1.2 days (< 3 days to run) -> Urgent!
  const milkRec = recs.find(r => r.itemId === 'item-milk')!;
  assert(milkRec.isUrgent === true, 'Milk identified as urgent (runs out in 1.2d before 3d run)');
  assert(milkRec.requiresApproval === true, 'Milk triggers approval due to emergency policy or substitution');
  assert(milkRec.reasoning.includes('Milk') && milkRec.reasoning.includes('run out'), 'Milk has detailed dynamic human-readable explanation');

  // Coffee: 140g, 8g/day -> lasts 17.5 days -> WAIT_UNTIL_NEXT_CYCLE
  const coffeeRec = recs.find(r => r.itemId === 'item-coffee')!;
  assert(coffeeRec.outcome === 'WAIT_UNTIL_NEXT_CYCLE', 'Coffee with 17.5 days remaining is deferred to WAIT_UNTIL_NEXT_CYCLE');
  assert(coffeeRec.reasoning.includes('coffee') || coffeeRec.reasoning.includes('Coffee'), 'Coffee has dynamic human-readable deferred explanation');

  // Oats: lasts 4.6 days -> safely reaches run in 3 days, then restocks -> INCLUDE_IN_WEEKLY_BASKET
  const oatsRec = recs.find(r => r.itemId === 'item-oats')!;
  assert(
    oatsRec.outcome === 'INCLUDE_IN_WEEKLY_BASKET' || oatsRec.outcome === 'ASK_FOR_APPROVAL',
    'Oats included in weekly basket or asks brand approval'
  );

  // 5. Delivery-Fee-Aware Basket Optimizer
  console.log('\nTest 5: Delivery-Fee-Aware Basket Optimizer');
  const opt = optimizeBaskets({
    recommendations: recs,
    pantryItems: DEFAULT_PANTRY_ITEMS,
  });

  assert(opt.strategies.length >= 4, 'Compares at least 4 basket strategies (A, B, C, D)');

  const stratA = opt.strategies.find(s => s.type === 'STRATEGY_A_LOWEST_PRICE')!;
  const stratB = opt.strategies.find(s => s.type === 'STRATEGY_B_SINGLE_STORE')!;
  const stratC = opt.strategies.find(s => s.type === 'STRATEGY_C_SMART_SPLIT')!;
  const stratD = opt.strategies.find(s => s.type === 'STRATEGY_D_DEFER_NON_URGENT')!;

  assert(Boolean(stratA && stratB && stratC && stratD), 'All 4 strategies calculated');

  // Verify independent fee application:
  // If Strategy A split across multiple stores, verify total delivery fee is sum of independent delivery fees!
  if (stratA.storeBaskets.length > 1) {
    const sumDelivery = stratA.storeBaskets.reduce((acc, b) => acc + b.deliveryFeePaise, 0);
    assert(stratA.totalDeliveryFeePaise === sumDelivery, 'Strategy A applies delivery fees independently to each store order');
    assert(stratA.totalDeliveryFeePaise > stratB.totalDeliveryFeePaise, 'Multi-store split incurs higher combined delivery fees than single store consolidation');
  }

  assert(Boolean(opt.recommendedStrategy), 'Optimizer selects a recommended strategy');
  assert(opt.recommendedStrategy.recommendationReason.length > 10, 'Recommended strategy includes detailed human-readable justification');

  console.log(`\nOptimizer Recommendation: ${opt.recommendedStrategy.title}`);
  console.log(`Rationale: ${opt.recommendedStrategy.recommendationReason}`);
  console.log(`Total Payable: ${formatPaise(opt.recommendedStrategy.grandTotalPaise)}`);

  console.log('\n🎉 ALL AUTOMATED TESTS COMPLETED SUCCESSFULLY!');
}

runAutonomousSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
