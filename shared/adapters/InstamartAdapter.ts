import { IGroceryStoreAdapter, StoreFeeBreakdown } from './types';
import { PantryItem, StoreId, StoreInfo, StoreProduct } from '../types';
import { MOCK_STORE_CATALOG, STORE_DEFINITIONS } from './mockStoreData';
import { calculateGstPaise } from '../services/currency';

export class InstamartAdapter implements IGroceryStoreAdapter {
  readonly storeId: StoreId = 'instamart';
  readonly storeInfo: StoreInfo = STORE_DEFINITIONS.instamart;
  readonly isLive: boolean = false;
  readonly dataSourceType = 'mock' as const;
  readonly disclaimer: string = 'Demo mode — simulated store prices and availability for Swiggy Instamart.';

  async searchProducts(searchTerm: string): Promise<StoreProduct[]> {
    const term = searchTerm.toLowerCase();
    return MOCK_STORE_CATALOG.filter(
      p => p.storeId === 'instamart' && (p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term))
    );
  }

  async getProductForPantryItem(item: PantryItem): Promise<StoreProduct | null> {
    const candidates = MOCK_STORE_CATALOG.filter(
      p => p.storeId === 'instamart' && p.pantryItemId === item.id && p.inStock
    );

    if (candidates.length === 0) return null;

    // Prefer exact brand match
    const exact = candidates.find(c => c.brand.toLowerCase() === item.preferredBrand.toLowerCase());
    if (exact) return exact;

    // If substitutions allowed, return first in-stock alternative
    if (item.allowSubstitutions) {
      return candidates[0];
    }

    return null;
  }

  calculateStoreFees(productSubtotalPaise: number): StoreFeeBreakdown {
    if (productSubtotalPaise === 0) {
      return {
        deliveryFeePaise: 0,
        handlingFeePaise: 0,
        surgeFeePaise: 0,
        minOrderThresholdPaise: this.storeInfo.minOrderThresholdPaise,
        minOrderShortfallPaise: 0,
        taxPaise: 0,
        isEligibleForFreeDelivery: false,
        totalFeesPaise: 0,
      };
    }

    const isFree = productSubtotalPaise >= this.storeInfo.freeDeliveryThresholdPaise;
    const deliveryFeePaise = isFree ? 0 : this.storeInfo.deliveryFeeBasePaise;
    const handlingFeePaise = this.storeInfo.handlingFeePaise;
    const surgeFeePaise = this.storeInfo.surgeFeePaise;
    const minOrderShortfallPaise = Math.max(0, this.storeInfo.minOrderThresholdPaise - productSubtotalPaise);
    const taxPaise = calculateGstPaise(productSubtotalPaise, 5);

    const totalFeesPaise = deliveryFeePaise + handlingFeePaise + surgeFeePaise + minOrderShortfallPaise + taxPaise;

    return {
      deliveryFeePaise,
      handlingFeePaise,
      surgeFeePaise,
      minOrderThresholdPaise: this.storeInfo.minOrderThresholdPaise,
      minOrderShortfallPaise,
      taxPaise,
      isEligibleForFreeDelivery: isFree,
      totalFeesPaise,
    };
  }

  async checkStockStatus(productIds: string[]): Promise<Map<string, { inStock: boolean; availableQty: number }>> {
    const map = new Map<string, { inStock: boolean; availableQty: number }>();
    for (const id of productIds) {
      const prod = MOCK_STORE_CATALOG.find(p => p.id === id && p.storeId === 'instamart');
      if (prod) {
        map.set(id, { inStock: prod.inStock, availableQty: prod.stockQuantity });
      } else {
        map.set(id, { inStock: false, availableQty: 0 });
      }
    }
    return map;
  }
}
