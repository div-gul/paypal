import { IGroceryStoreAdapter } from '@shared/adapters/types';
import { BlinkitAdapter } from '@shared/adapters/BlinkitAdapter';
import { ZeptoAdapter } from '@shared/adapters/ZeptoAdapter';
import { InstamartAdapter } from '@shared/adapters/InstamartAdapter';
import { PantryItem, StoreId, StoreProduct } from '@shared/types';

interface CacheEntry {
  data: StoreProduct[];
  expiresAt: number;
}

export class ServerAdapterRegistry {
  private storeAdapters: Map<StoreId, IGroceryStoreAdapter>;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly ttlMs: number = 5 * 60 * 1000; // 5 minute TTL cache

  constructor() {
    this.storeAdapters = new Map([
      ['blinkit', new BlinkitAdapter()],
      ['zepto', new ZeptoAdapter()],
      ['instamart', new InstamartAdapter()],
    ]);

  }

  getStoreIds(): StoreId[] {
    return [...this.storeAdapters.keys()];
  }

  getStoreAdapter(storeId: StoreId): IGroceryStoreAdapter {
    const adapter = this.storeAdapters.get(storeId);
    if (!adapter) throw new Error(`Adapter for ${storeId} not found`);
    return adapter;
  }

  async getQuotesForPantryItem(item: PantryItem): Promise<StoreProduct[]> {
    const cacheKey = `item:${item.id}:${item.preferredBrand}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() <= cached.expiresAt) {
      return cached.data;
    }

    const quotes = await this.getStoreQuotes(item);

    this.cache.set(cacheKey, {
      data: quotes,
      expiresAt: Date.now() + this.ttlMs,
    });

    return quotes;
  }

  async getAllQuotes(pantryItems: PantryItem[]): Promise<StoreProduct[]> {
    const allQuotes: StoreProduct[] = [];

    for (const item of pantryItems) {
      allQuotes.push(...(await this.getQuotesForPantryItem(item)));
    }

    return allQuotes;
  }

  private async getStoreQuotes(item: PantryItem): Promise<StoreProduct[]> {
    const quotes: StoreProduct[] = [];
    for (const [, adapter] of this.storeAdapters.entries()) {
      const prod = await adapter.getProductForPantryItem(item);
      if (prod) {
        quotes.push(prod);
      }
    }
    return quotes;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const serverAdapterRegistry = new ServerAdapterRegistry();
