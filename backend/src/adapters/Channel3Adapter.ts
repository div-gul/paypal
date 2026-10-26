import {
  IGroceryStoreAdapter,
  StoreFeeBreakdown,
  DataSourceMode,
} from '@shared/adapters/types';
import {
  PantryItem,
  StoreId,
  StoreInfo,
  StoreProduct,
} from '@shared/types';
import { calculateGstPaise } from '@shared/services/currency';

// Documented fixed exchange rate for Channel3 multi-currency offers
export const USD_TO_INR_RATE = 85.0; // 1 USD = ₹85.00 INR = 8500 Paise

export interface Channel3SearchOffer {
  id?: string;
  price?: number;
  original_price?: number;
  currency?: string;
  availability?: string;
  url?: string;
  store_name?: string;
}

export interface Channel3ProductItem {
  id: string;
  title?: string;
  name?: string;
  brand?: string | { name: string };
  price?: number;
  currency?: string;
  package_size?: string;
  offers?: Channel3SearchOffer[];
  in_stock?: boolean;
}

export interface Channel3SearchResponse {
  results?: Channel3ProductItem[];
  products?: Channel3ProductItem[];
}

export class Channel3Adapter implements IGroceryStoreAdapter {
  readonly storeId: StoreId = 'instamart'; // Channel3 maps to instant catalog partner
  readonly storeInfo: StoreInfo = {
    id: 'instamart',
    name: 'Channel3 Live Search',
    brandColor: '#2563EB',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
    tagline: 'Live real-time product search powered by Channel3',
    deliveryFeeBasePaise: 2900,
    freeDeliveryThresholdPaise: 49900,
    handlingFeePaise: 600,
    surgeFeePaise: 0,
    minOrderThresholdPaise: 19900,
    estimatedDeliveryMinutes: 15,
  };
  readonly isLive: boolean = true;
  readonly dataSourceType: DataSourceMode = 'live';
  readonly disclaimer: string = 'Real-time prices from Channel3 API.';

  constructor(
    private apiKey?: string,
    private apiEndpoint: string = 'https://api.trychannel3.com/v1/search',
    private fetchFn: typeof fetch = fetch
  ) {}

  async searchProducts(searchTerm: string, userId: string = 'demo-user'): Promise<StoreProduct[]> {
    if (!this.apiKey) {
      throw new Error('CHANNEL3_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await this.fetchFn(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'x-user-id': userId,
        },
        body: JSON.stringify({
          query: searchTerm,
          limit: 10,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Channel3 API HTTP error: ${response.status} ${response.statusText}`);
      }

      const data: Channel3SearchResponse = await response.json();
      const rawProducts = data.results || data.products || [];

      return rawProducts.map(p => this.mapToStoreProduct(p, searchTerm));
    } finally {
      clearTimeout(timeout);
    }
  }

  async getProductForPantryItem(item: PantryItem, userId: string = 'demo-user'): Promise<StoreProduct | null> {
    const query = `${item.preferredBrand} ${item.name}`;
    const products = await this.searchProducts(query, userId);

    if (products.length === 0) {
      return null;
    }

    // Exact brand match preferred
    const exact = products.find(p => p.brand.toLowerCase() === item.preferredBrand.toLowerCase());
    if (exact) return exact;

    if (item.allowSubstitutions) {
      return products[0];
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

    return {
      deliveryFeePaise,
      handlingFeePaise,
      surgeFeePaise,
      minOrderThresholdPaise: this.storeInfo.minOrderThresholdPaise,
      minOrderShortfallPaise,
      taxPaise,
      isEligibleForFreeDelivery: isFree,
      totalFeesPaise: deliveryFeePaise + handlingFeePaise + surgeFeePaise + minOrderShortfallPaise + taxPaise,
    };
  }

  async checkStockStatus(productIds: string[]): Promise<Map<string, { inStock: boolean; availableQty: number }>> {
    const result = new Map<string, { inStock: boolean; availableQty: number }>();
    for (const id of productIds) {
      result.set(id, { inStock: true, availableQty: 25 });
    }
    return result;
  }

  private mapToStoreProduct(item: Channel3ProductItem, queryHint: string): StoreProduct {
    const rawBrand: string =
      typeof item.brand === 'object' && item.brand !== null
        ? item.brand.name
        : typeof item.brand === 'string'
        ? item.brand
        : 'Generic';
    const rawPrice = item.price ?? (item.offers && item.offers[0]?.price) ?? 5.0;
    const rawCurrency = (item.currency || (item.offers && item.offers[0]?.currency) || 'INR').toUpperCase();

    // Convert price to integer Paise
    let pricePaise: number;
    if (rawCurrency === 'USD') {
      pricePaise = Math.round(rawPrice * USD_TO_INR_RATE * 100);
    } else {
      // Assuming INR
      pricePaise = Math.round(rawPrice * 100);
    }

    return {
      id: `c3-${item.id}`,
      storeId: 'instamart',
      pantryItemId: queryHint,
      name: item.title || item.name || queryHint,
      brand: rawBrand,
      packageSize: item.package_size || '1 unit',
      unit: 'units',
      pricePaise,
      mrpPaise: Math.round(pricePaise * 1.1),
      inStock: item.in_stock ?? true,
      stockQuantity: 20,
      isExactBrandMatch: false,
      source: 'channel3',
    };
  }
}
