import { IGroceryStoreAdapter } from '@shared/adapters/types';
import { BlinkitAdapter } from '@shared/adapters/BlinkitAdapter';
import { ZeptoAdapter } from '@shared/adapters/ZeptoAdapter';
import { InstamartAdapter } from '@shared/adapters/InstamartAdapter';
import { PantryItem, StoreId, StoreProduct } from '@shared/types';
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
    const cacheKey = `item:${item.id}:${item.preferredBrand}:${this.quoteSource}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let quotes: StoreProduct[] = [];

    if (this.quoteSource === 'channel3' && this.channel3Adapter) {
      try {
        const prod = await this.channel3Adapter.getProductForPantryItem(item, userId);
        if (prod) {
          quotes = [{ ...prod, pantryItemId: item.id, source: 'channel3' }];
        } else {
          console.warn(`[QuoteService] Channel3 returned no results for "${item.name}". Falling back to mock.`);
          quotes = await this.getMockQuotes(item);
        }
      } catch (err) {
        console.warn(`[QuoteService] Channel3 error for "${item.name}":`, err instanceof Error ? err.message : err);
        console.warn(`[QuoteService] Falling back to mock adapter.`);
        quotes = await this.getMockQuotes(item);
      }
    } else if (this.quoteSource === 'hybrid' && this.channel3Adapter) {
      try {
        const prod = await this.channel3Adapter.getProductForPantryItem(item, userId);
        if (prod) {
          quotes.push({ ...prod, pantryItemId: item.id, source: 'channel3' });
        }
      } catch (err) {
        console.warn(`[QuoteService] Channel3 hybrid query error for "${item.name}":`, err instanceof Error ? err.message : err);
      }

      // Add mock quotes for comprehensive multi-store comparison
      const mockQuotes = await this.getMockQuotes(item);
      for (const mq of mockQuotes) {
        if (!quotes.some(q => q.storeId === mq.storeId)) {
          quotes.push(mq);
        }
      }
    } else {
      // Mock mode default
      quotes = await this.getMockQuotes(item);
    }

    this.setCache(cacheKey, quotes);
    return quotes;
  }

  async getAllQuotes(pantryItems: PantryItem[], userId: string = 'demo-user'): Promise<StoreProduct[]> {
    const results: StoreProduct[] = [];
    for (const item of pantryItems) {
      const itemQuotes = await this.getQuotesForPantryItem(item, userId);
      results.push(...itemQuotes);
    }
    return results;
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
