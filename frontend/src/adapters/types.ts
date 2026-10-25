import { PantryItem, StoreId, StoreInfo, StoreProduct } from '../types';

export type DataSourceMode = 'mock' | 'live' | 'cached';

export interface StoreFeeBreakdown {
  deliveryFeePaise: number;
  handlingFeePaise: number;
  surgeFeePaise: number;
  minOrderThresholdPaise: number;
  minOrderShortfallPaise: number;
  taxPaise: number;
  isEligibleForFreeDelivery: boolean;
  totalFeesPaise: number;
}

export interface IGroceryStoreAdapter {
  readonly storeId: StoreId;
  readonly storeInfo: StoreInfo;
  readonly isLive: boolean;
  readonly dataSourceType: DataSourceMode;
  readonly disclaimer: string;

  /**
   * Search for products matching a query or pantry item specifications.
   */
  searchProducts(searchTerm: string): Promise<StoreProduct[]>;

  /**
   * Find best matching product for a specific pantry item, accounting for brand preference
   * and substitutions rule.
   */
  getProductForPantryItem(item: PantryItem): Promise<StoreProduct | null>;

  /**
   * Calculate precise store fees given a basket product subtotal.
   * Handles delivery fees, platform handling fee, surge fee, and minimum order rules.
   */
  calculateStoreFees(productSubtotalPaise: number): StoreFeeBreakdown;

  /**
   * Check live availability status for given store product IDs.
   */
  checkStockStatus(productIds: string[]): Promise<Map<string, { inStock: boolean; availableQty: number }>>;
}
