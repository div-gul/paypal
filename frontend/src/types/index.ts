export type StoreId = 'blinkit' | 'zepto' | 'instamart';

export type ProductCategory = 
  | 'Dairy'
  | 'Bakery & Bread'
  | 'Fresh Produce'
  | 'Beverages'
  | 'Pantry Staples'
  | 'Breakfast & Cereals'
  | 'Snacks'
  | 'Personal Care';

export type UnitOfMeasurement = 'L' | 'kg' | 'g' | 'ml' | 'packs' | 'pcs' | 'units' | 'eggs';

export interface PantryItem {
  id: string;
  name: string;
  category: ProductCategory;
  preferredBrand: string;
  preferredPackageSize: string;
  unit: UnitOfMeasurement;
  currentQuantity: number;
  averageDailyConsumption: number;
  minStockThreshold: number;
  targetStock: number;
  allowSubstitutions: boolean;
  requireApprovalForBrandChange: boolean;
  lastRestockedDate: string;
  stockoutDaysCount: number; // 0 if stock > 0, otherwise number of days empty
}

export type RestockDecisionOutcome =
  | 'RESTOCK_NOW'
  | 'INCLUDE_IN_WEEKLY_BASKET'
  | 'WAIT_UNTIL_NEXT_CYCLE'
  | 'ASK_FOR_APPROVAL'
  | 'BLOCKED';

export interface RestockRecommendation {
  itemId: string;
  itemName: string;
  category: ProductCategory;
  currentQuantity: number;
  unit: UnitOfMeasurement;
  daysRemaining: number | null;
  projectedStockAtNextRun: number;
  isUrgent: boolean;
  outcome: RestockDecisionOutcome;
  reasoning: string;
  recommendedQuantity: number;
  targetPackageSize: string;
  selectedStore: StoreId | null;
  selectedProduct: StoreProduct | null;
  requiresApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalReason?: string;
}

export interface StoreInfo {
  id: StoreId;
  name: string;
  brandColor: string;
  badgeBg: string;
  tagline: string;
  deliveryFeeBasePaise: number;
  freeDeliveryThresholdPaise: number;
  handlingFeePaise: number;
  surgeFeePaise: number;
  minOrderThresholdPaise: number;
  estimatedDeliveryMinutes: number;
}

export interface StoreProduct {
  id: string;
  storeId: StoreId;
  pantryItemId: string;
  name: string;
  brand: string;
  packageSize: string;
  unit: UnitOfMeasurement;
  pricePaise: number; // e.g. 6800 = ₹68.00
  mrpPaise: number;
  inStock: boolean;
  stockQuantity: number;
  isExactBrandMatch: boolean;
}

export type BasketStrategyType =
  | 'STRATEGY_A_LOWEST_PRICE'
  | 'STRATEGY_B_SINGLE_STORE'
  | 'STRATEGY_C_SMART_SPLIT'
  | 'STRATEGY_D_DEFER_NON_URGENT';

export interface BasketItem {
  product: StoreProduct;
  pantryItemId: string;
  quantity: number;
  totalPaise: number;
  isSubstitution: boolean;
}

export interface StoreSubBasket {
  storeId: StoreId;
  storeName: string;
  items: BasketItem[];
  productSubtotalPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  taxPaise: number;
  discountsPaise: number;
  minOrderShortfallPaise: number;
  totalPaise: number;
  meetsMinOrder: boolean;
  minOrderThresholdPaise: number;
}

export interface BasketStrategyResult {
  type: BasketStrategyType;
  title: string;
  tag: string;
  description: string;
  storeBaskets: StoreSubBasket[];
  totalProductPaise: number;
  totalDeliveryFeePaise: number;
  totalHandlingFeePaise: number;
  totalTaxPaise: number;
  totalDiscountPaise: number;
  grandTotalPaise: number;
  isRecommended: boolean;
  recommendationReason: string;
  storesInvolvedCount: number;
}

export interface WeeklySchedulerConfig {
  preferredShoppingDay: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  shoppingFrequency: 'weekly' | 'biweekly';
  nextShoppingDate: string; // ISO string
  emergencyRestockPreference: 'ask_approval' | 'auto_order' | 'alert_only';
  urgentThresholdDays: number;
  perCycleBudgetPaise: number;
}

export interface SimulationState {
  simulatedDate: string; // ISO string
  daysElapsed: number;
  cycleCount: number;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string; // real time
  simulatedDate: string; // simulation date
  type: 
    | 'time_advanced'
    | 'analysis_run'
    | 'recommendation_made'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_rejected'
    | 'checkout_completed'
    | 'pantry_updated'
    | 'stockout_warning'
    | 'policy_applied';
  title: string;
  description: string;
  statusBadge?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'red' | 'blue' | 'indigo' | 'purple';
}
