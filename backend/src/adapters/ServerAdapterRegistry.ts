import { IGroceryStoreAdapter } from '@shared/adapters/types';
import { BlinkitAdapter } from '@shared/adapters/BlinkitAdapter';
import { ZeptoAdapter } from '@shared/adapters/ZeptoAdapter';
import { InstamartAdapter } from '@shared/adapters/InstamartAdapter';
import { PantryItem, StoreId, StoreProduct, isNonGroceryItem } from '@shared/types';
import { Channel3Adapter } from './Channel3Adapter.js';
import { config } from '../config.js';

interface CacheEntry {
  data: StoreProduct[];
  expiresAt: number;
}

export class ServerAdapterRegistry {
  private mockAdapters: Map<StoreId, IGroceryStoreAdapter>;
  private channel3Adapter: Channel3Adapter | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly ttlMs: number = 5 * 60 * 1000; // 5 minute TTL cache

  constructor(
    private quoteSource: 'mock' | 'channel3' | 'hybrid' = config.QUOTE_SOURCE,
    channel3ApiKey: string | undefined = config.CHANNEL3_API_KEY,
    customFetch?: typeof fetch
  ) {
    this.mockAdapters = new Map([
      ['blinkit', new BlinkitAdapter()],
      ['zepto', new ZeptoAdapter()],
      ['instamart', new InstamartAdapter()],
    ]);

    if (channel3ApiKey) {
      this.channel3Adapter = new Channel3Adapter(channel3ApiKey, undefined, customFetch);
    }
  }

  getStoreIds(): StoreId[] {
    return ['blinkit', 'zepto', 'instamart'];
  }

  getMockAdapter(storeId: StoreId): IGroceryStoreAdapter {
    const adapter = this.mockAdapters.get(storeId);
    if (!adapter) throw new Error(`Adapter for ${storeId} not found`);
    return adapter;
  }

  async getQuotesForPantryItem(item: PantryItem, userId: string = 'demo-user'): Promise<StoreProduct[]> {
    const { quotes } = await this.getQuotesWithWebSeparation(item, userId);
    return quotes;
  }

  async getQuotesWithWebSeparation(
    item: PantryItem,
    userId: string = 'demo-user'
  ): Promise<{ quotes: StoreProduct[]; webQuotes: StoreProduct[] }> {
    const cacheKey = `item-v2:${item.id}:${item.preferredBrand}:${this.quoteSource}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() <= cached.expiresAt) {
      const q = cached.data.filter(p => p.storeId !== 'web');
      const w = cached.data.filter(p => p.storeId === 'web');
      return { quotes: q, webQuotes: w };
    }

    let quotes: StoreProduct[] = [];
    let webQuotes: StoreProduct[] = [];

    // 1. Get mock quick-commerce quotes
    const mockQuotes = await this.getMockQuotes(item);

    // 2. Query Channel3 if configured (strictly for non-grocery items: detergent, cleaning supplies, etc.)
    if (isNonGroceryItem(item) && (this.quoteSource === 'channel3' || this.quoteSource === 'hybrid') && this.channel3Adapter) {
      try {
        const prod = await this.channel3Adapter.getProductForPantryItem(item, userId);
        if (prod) {
          const webProduct: StoreProduct = {
            ...prod,
            pantryItemId: item.id,
            storeId: 'web',
            source: 'channel3',
          };
          webQuotes.push(webProduct);
        }
      } catch (err) {
        console.warn(`[QuoteService] Channel3 query error for "${item.name}":`, err instanceof Error ? err.message : err);
      }
    }

    if (this.quoteSource === 'channel3') {
      // In channel3-only mode, if a valid web quote exists it is the web quote; mock quotes used only as fallback
      if (webQuotes.length > 0) {
        quotes = [...mockQuotes];
      } else {
        quotes = [...mockQuotes];
      }
    } else {
      // Hybrid or mock mode: quick-commerce stores are strictly mock, web quotes are separate
      quotes = [...mockQuotes];
    }

    // Cache all combined
    this.cache.set(cacheKey, {
      data: [...quotes, ...webQuotes],
      expiresAt: Date.now() + this.ttlMs,
    });

    return { quotes, webQuotes };
  }

  async getAllQuotes(
    pantryItems: PantryItem[],
    userId: string = 'demo-user'
  ): Promise<{ quotes: StoreProduct[]; webQuotes: StoreProduct[] }> {
    const allQuotes: StoreProduct[] = [];
    const allWebQuotes: StoreProduct[] = [];

    for (const item of pantryItems) {
      const { quotes, webQuotes } = await this.getQuotesWithWebSeparation(item, userId);
      allQuotes.push(...quotes);
      allWebQuotes.push(...webQuotes);
    }

    return { quotes: allQuotes, webQuotes: allWebQuotes };
  }

  private async getMockQuotes(item: PantryItem): Promise<StoreProduct[]> {
    const quotes: StoreProduct[] = [];
    for (const [, adapter] of this.mockAdapters.entries()) {
      const prod = await adapter.getProductForPantryItem(item);
      if (prod) {
        quotes.push({
          ...prod,
          source: 'mock',
        });
      }
    }
    return quotes;
  }

  private getFromCache(key: string): StoreProduct[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: StoreProduct[]): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const serverAdapterRegistry = new ServerAdapterRegistry();
