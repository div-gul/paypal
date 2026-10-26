import {
  ActivityLogItem,
  PantryItem,
  SimulationState,
  WeeklySchedulerConfig,
} from '../types';

// Initial benchmark simulation date: Saturday, Oct 24, 2026
export const INITIAL_SIMULATED_DATE = '2026-10-24T10:00:00.000Z';
// Next scheduled shopping run: Tuesday, Oct 27, 2026 (3 days away)
export const INITIAL_NEXT_SHOPPING_DATE = '2026-10-27T10:00:00.000Z';

export const DEFAULT_PANTRY_ITEMS: PantryItem[] = [
  {
    id: 'item-milk',
    name: 'Fresh Toned Milk',
    category: 'Dairy',
    preferredBrand: 'Amul',
    preferredPackageSize: '1 L',
    unit: 'L',
    currentQuantity: 0.6, // Lasts 1.2 days at 0.5 L/day -> Urgent (runs out before day 3!)
    averageDailyConsumption: 0.5,
    minStockThreshold: 1.0,
    targetStock: 3.0,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-21T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-bread',
    name: '100% Whole Wheat Bread',
    category: 'Bakery & Bread',
    preferredBrand: 'Harvest Gold',
    preferredPackageSize: '400g',
    unit: 'g',
    currentQuantity: 150, // Lasts 1.5 days at 100g/day -> Urgent!
    averageDailyConsumption: 100,
    minStockThreshold: 200,
    targetStock: 800,
    allowSubstitutions: true,
    requireApprovalForBrandChange: false,
    lastRestockedDate: '2026-10-21T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-eggs',
    name: 'Farm Fresh White Eggs',
    category: 'Dairy',
    preferredBrand: 'Eggoz',
    preferredPackageSize: '6 pcs',
    unit: 'eggs',
    currentQuantity: 4, // Lasts 2 days at 2 eggs/day -> Urgent!
    averageDailyConsumption: 2,
    minStockThreshold: 6,
    targetStock: 12,
    allowSubstitutions: true,
    requireApprovalForBrandChange: false,
    lastRestockedDate: '2026-10-20T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-oats',
    name: 'Rolled Oats Whole Grain',
    category: 'Breakfast & Cereals',
    preferredBrand: 'Quaker',
    preferredPackageSize: '1 kg',
    unit: 'kg',
    currentQuantity: 0.28, // Lasts ~4.6 days at 0.06 kg/day -> Safe until weekly run, then restock!
    averageDailyConsumption: 0.06,
    minStockThreshold: 0.2,
    targetStock: 1.0,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-14T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-coffee',
    name: 'Pure Instant Coffee',
    category: 'Beverages',
    preferredBrand: 'Nescafe',
    preferredPackageSize: '200g',
    unit: 'g',
    currentQuantity: 140, // Lasts 17.5 days at 8g/day -> No restock needed!
    averageDailyConsumption: 8,
    minStockThreshold: 50,
    targetStock: 200,
    allowSubstitutions: false,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-10T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-oil',
    name: 'Refined Sunflower Oil',
    category: 'Pantry Staples',
    preferredBrand: 'Fortune',
    preferredPackageSize: '1 L',
    unit: 'L',
    currentQuantity: 0.35, // Lasts ~4.3 days at 0.08 L/day -> Bundled into weekly run!
    averageDailyConsumption: 0.08,
    minStockThreshold: 0.3,
    targetStock: 2.0,
    allowSubstitutions: false,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-08T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-rice',
    name: 'Basmati Rice Premium',
    category: 'Pantry Staples',
    preferredBrand: 'India Gate',
    preferredPackageSize: '5 kg',
    unit: 'kg',
    currentQuantity: 3.8, // Lasts 15 days at 0.25 kg/day -> Safe!
    averageDailyConsumption: 0.25,
    minStockThreshold: 1.5,
    targetStock: 5.0,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-01T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
  {
    id: 'item-detergent',
    name: 'Liquid Laundry Detergent',
    category: 'Personal Care',
    preferredBrand: 'Surf Excel',
    preferredPackageSize: '2 L',
    unit: 'L',
    currentQuantity: 0.9, // Lasts 15 days at 0.06 L/day -> Safe!
    averageDailyConsumption: 0.06,
    minStockThreshold: 0.5,
    targetStock: 2.0,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-05T08:00:00.000Z',
    stockoutDaysCount: 0,
  },
];

export const DEFAULT_SCHEDULER_CONFIG: WeeklySchedulerConfig = {
  preferredShoppingDay: 2, // Tuesday
  shoppingFrequency: 'weekly',
  nextShoppingDate: INITIAL_NEXT_SHOPPING_DATE,
  emergencyRestockPreference: 'ask_approval',
  urgentThresholdDays: 3,
  perCycleBudgetPaise: 250000, // ₹2,500.00
};

export const DEFAULT_SIMULATION_STATE: SimulationState = {
  simulatedDate: INITIAL_SIMULATED_DATE,
  daysElapsed: 0,
  cycleCount: 1,
};

export const DEFAULT_ACTIVITY_LOG: ActivityLogItem[] = [
  {
    id: 'log-init-1',
    timestamp: '2026-10-24T10:00:00.000Z',
    simulatedDate: INITIAL_SIMULATED_DATE,
    type: 'analysis_run',
    title: 'Autonomous System Initialized',
    description: 'ShopPilot AI pantry engine started. 8 household items loaded with consumption forecasts.',
    statusBadge: 'Ready',
    badgeColor: 'blue',
  },
  {
    id: 'log-init-2',
    timestamp: '2026-10-24T10:00:00.000Z',
    simulatedDate: INITIAL_SIMULATED_DATE,
    type: 'recommendation_made',
    title: 'Weekly Cycle Analysis Scheduled',
    description: 'Next scheduled shopping run is in 3 days. Milk, Bread, and Eggs identified as running out before the run.',
    statusBadge: 'Urgent Alert',
    badgeColor: 'amber',
  },
];
