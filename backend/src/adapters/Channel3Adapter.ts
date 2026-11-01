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
  isNonGroceryItem,
} from '@shared/types';

// Documented fixed exchange rate for Channel3 multi-currency offers
export const USD_TO_INR_RATE = 85.0; // 1 USD = ₹85.00 INR = 8500 Paise

interface Channel3SearchOffer {
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

interface Channel3SearchResponse {
  results?: Channel3ProductItem[];
  products?: Channel3ProductItem[];
}

export class Channel3Adapter implements IGroceryStoreAdapter {
  readonly storeId: StoreId = 'web';
  readonly storeInfo: StoreInfo = {
    id: 'web',
    name: 'Other retailers',
    brandColor: '#2563EB',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
    tagline: 'Real web product price check for non-grocery items powered by Channel3',
    deliveryFeeBasePaise: 0,
    freeDeliveryThresholdPaise: 0,
    handlingFeePaise: 0,
    surgeFeePaise: 0,
    minOrderThresholdPaise: 0,
    estimatedDeliveryMinutes: 0,
  };
  readonly isLive: boolean = true;
  readonly dataSourceType: DataSourceMode = 'live';
  readonly disclaimer: string = 'Real web product price check from Channel3 API.';

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

      const mapped: StoreProduct[] = [];
      for (const p of rawProducts) {
        const prod = this.mapToStoreProduct(p, searchTerm);
        if (prod && prod.pricePaise !== null) {
          mapped.push(prod);
        }
      }
      return mapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getProductForPantryItem(item: PantryItem, userId: string = 'demo-user'): Promise<StoreProduct | null> {
    // Only search Channel3 for non-grocery items (detergent, cleaning supplies, personal care)
    // Completely skip Channel3 for edible grocery/food items
    if (!isNonGroceryItem(item)) {
      return null;
    }

    const query = `${item.preferredBrand} ${item.name}`;
    const products = await this.searchProducts(query, userId);

    if (products.length === 0) {
      return null;
    }

    // Filter products strictly through the relevance check
    const usableProducts = products.filter(p => this.isRelevantResult(item, p));
    if (usableProducts.length === 0) {
      return null;
    }

    // Exact brand match preferred if available
    const exact = usableProducts.find(
      p => p.brand && p.brand.toLowerCase() === item.preferredBrand.toLowerCase()
    );
    if (exact) return exact;

    if (item.allowSubstitutions) {
      return usableProducts[0];
    }

    return null;
  }

  /**
   * Evaluates relevance between a pantry item and a Channel3 product.
   * Drops obvious mismatches (e.g. wall art for eggs, toner for milk) and requires
   * meaningful keyword or category overlap.
   */
  isRelevantResult(item: PantryItem, product: StoreProduct): boolean {
    // 0. Only non-grocery items are eligible for web quotes
    if (!isNonGroceryItem(item)) {
      return false;
    }

    // 1. Must have a valid, non-null, positive price
    if (product.pricePaise === null || product.pricePaise <= 0) {
      return false;
    }

    const title = (product.name || '').toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    const itemName = item.name.toLowerCase();
    const itemBrand = item.preferredBrand.toLowerCase();

    // 2. Reject obvious categorical / keyword contamination
    const obviousMismatches = [
      'wall art',
      'poster',
      'painting',
      'print',
      'canvas',
      'sculpture',
      'frame',
      'sign',
      'sticker',
      'stickers',
      'decal',
      'puzzle',
      'jigsaw',
      'toy',
      'game',
      'plush',
      'costume',
      'apparel',
      'shirt',
      't-shirt',
      'hoodie',
      'mug',
      'tumbler',
      'keychain',
      'magnet',
      'decor',
      'ornament',
      'book',
      'novel',
      'plate',
      'bowl',
      'dish',
      'cutlery',
      'porcelain',
      'ceramic',
      'plastic egg',
      'easter',
      'craft',
      'makeup',
      'foundation',
      'skin milk',
      'lotion',
      'toner',
      'skincare',
      'serum',
      'moisturizer',
      'perfume',
      'fragrance',
      'parfum',
      'cologne',
      'candle',
      'shampoo',
      'conditioner',
      'body wash',
      'cleanser',
      'soap',
      'bath',
      'board',
      'cooker',
      'appliance',
      'feather',
      'farm supply',
      'feed',
      'livestock',
      'horse',
      'poultry',
      'equine',
      'animal feed',
      'seed',
      'lip balm',
      'lipstick',
    ];

    // Reject publishers / book brands or antique/furniture brands
    if (
      brand.includes('book') ||
      brand.includes('press') ||
      brand.includes('publish') ||
      brand.includes('createspace') ||
      brand.includes('chairish')
    ) {
      return false;
    }

    // Reject non-grocery retailer domains (bookstores, beauty, furniture, farm/feed supplies)
    const retailer = (product.retailer || '').toLowerCase();
    const nonGroceryRetailers = [
      'barnesandnoble.com',
      'strawberrynet.com',
      'chairish.com',
      'fragrancenet.com',
      'orientaltrading.com',
      'murdochs.com',
      'tractorsupply.com',
      'chewy.com',
      'petco.com',
      'petsmart.com',
    ];
    if (nonGroceryRetailers.some(r => retailer.includes(r))) {
      return false;
    }

    // Check if the item itself is in personal care/beauty; if NOT, reject beauty/decor terms
    if (item.category !== 'Personal Care') {
      for (const badWord of obviousMismatches) {
        if (title.includes(badWord)) {
          return false;
        }
      }
    }

    // Special checks for prominent pantry items
    if (itemName.includes('egg') && (!title.includes('egg') || title.includes('easter') || title.includes('plastic'))) {
      return false;
    }
    if (itemName.includes('milk') && (!title.includes('milk') || title.includes('toner') || title.includes('skin') || (title.includes('cream') && !title.includes('dairy')))) {
      return false;
    }
    if (itemName.includes('bread') && (!title.includes('bread') || title.includes('book'))) {
      return false;
    }
    if (itemName.includes('rice') && (!title.includes('rice') || title.includes('plate') || title.includes('porcelain') || title.includes('ceramic'))) {
      return false;
    }
    if (itemName.includes('detergent') && (!title.includes('detergent') && !title.includes('laundry') && !title.includes('wash'))) {
      return false;
    }

    // 3. Keyword matching: at least one significant word from the item name or brand must appear
    const cleanTokens = (str: string) =>
      str
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 2 && !['and', 'the', 'for', 'with', 'pack', 'fresh', '100%'].includes(t));

    const itemTokens = cleanTokens(`${itemBrand} ${itemName}`);
    const titleTokens = cleanTokens(`${brand} ${title}`);

    const hasOverlap = itemTokens.some(token => titleTokens.some(t => t.includes(token) || token.includes(t)));
    return hasOverlap;
  }

  calculateStoreFees(_productSubtotalPaise: number): StoreFeeBreakdown {
    return {
      deliveryFeePaise: 0,
      handlingFeePaise: 0,
      surgeFeePaise: 0,
      minOrderThresholdPaise: 0,
      minOrderShortfallPaise: 0,
      taxPaise: 0,
      isEligibleForFreeDelivery: true,
      totalFeesPaise: 0,
    };
  }

  async checkStockStatus(productIds: string[]): Promise<Map<string, { inStock: boolean; availableQty: number }>> {
    const result = new Map<string, { inStock: boolean; availableQty: number }>();
    for (const id of productIds) {
      result.set(id, { inStock: true, availableQty: 25 });
    }
    return result;
  }

  private mapToStoreProduct(item: Channel3ProductItem, queryHint: string): StoreProduct | null {
    // Brand: Use only real brand if present, otherwise null (no fake 'Generic' default)
    let rawBrand: string | null = null;
    if (Array.isArray((item as any).brands) && (item as any).brands.length > 0 && (item as any).brands[0]?.name) {
      rawBrand = (item as any).brands[0].name;
    } else if (typeof item.brand === 'object' && item.brand !== null && (item.brand as any).name) {
      rawBrand = (item.brand as any).name;
    } else if (typeof item.brand === 'string' && item.brand.trim()) {
      rawBrand = item.brand.trim();
    }

    // Extract real retailer/domain if available
    const firstOffer = item.offers && item.offers[0] ? (item.offers[0] as any) : undefined;
    const rawRetailer: string | null = firstOffer?.domain || firstOffer?.store_name || null;

    // Price extraction: null if not provided or invalid
    let rawPrice: number | null = null;
    let rawCurrency: string | null = null;

    if (firstOffer?.price && typeof firstOffer.price === 'object') {
      if (typeof firstOffer.price.price === 'number' && !isNaN(firstOffer.price.price)) {
        rawPrice = firstOffer.price.price;
        rawCurrency = (firstOffer.price.currency || 'USD').toUpperCase();
      }
    } else if (typeof firstOffer?.price === 'number' && !isNaN(firstOffer.price)) {
      rawPrice = firstOffer.price;
      rawCurrency = (firstOffer.currency || 'USD').toUpperCase();
    } else if (typeof item.price === 'number' && !isNaN(item.price)) {
      rawPrice = item.price;
      rawCurrency = (item.currency || 'USD').toUpperCase();
    }

    // Reject unknown currency or missing price
    let pricePaise: number | null = null;
    if (rawPrice !== null && rawPrice > 0 && (rawCurrency === 'USD' || rawCurrency === 'INR')) {
      if (rawCurrency === 'USD') {
        pricePaise = Math.round(rawPrice * USD_TO_INR_RATE * 100);
      } else {
        pricePaise = Math.round(rawPrice * 100);
      }
    }

    if (pricePaise === null || pricePaise <= 0) {
      return null;
    }

    return {
      id: `c3-${item.id}`,
      storeId: 'web',
      pantryItemId: queryHint,
      name: item.title || item.name || queryHint,
      brand: rawBrand || '',
      packageSize: item.package_size || '',
      unit: 'units',
      pricePaise,
      mrpPaise: Math.round(pricePaise * 1.1),
      inStock: item.in_stock ?? true,
      stockQuantity: 0,
      isExactBrandMatch: false,
      source: 'channel3',
      retailer: rawRetailer || 'Other retailers',
      currency: rawCurrency || 'USD',
    };
  }
}

