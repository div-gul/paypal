import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Channel3Adapter, USD_TO_INR_RATE } from '../adapters/Channel3Adapter.js';
import { ServerAdapterRegistry } from '../adapters/ServerAdapterRegistry.js';
import { PantryItem } from '@shared/types';

describe('Phase 3b: Quote Sources & Channel3 Integration', () => {
  const samplePantryItem: PantryItem = {
    id: 'item-milk',
    name: 'Fresh Toned Milk',
    category: 'Dairy',
    preferredBrand: 'Amul',
    preferredPackageSize: '1 L',
    unit: 'L',
    currentQuantity: 0.6,
    averageDailyConsumption: 0.5,
    minStockThreshold: 1.0,
    targetStock: 3.0,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-21T08:00:00.000Z',
    stockoutDaysCount: 0,
  };

  const detergentItem: PantryItem = {
    id: 'item-detergent',
    name: 'Liquid Laundry Detergent',
    category: 'Personal Care',
    preferredBrand: 'Surf Excel',
    preferredPackageSize: '2 L',
    unit: 'L',
    currentQuantity: 1.0,
    averageDailyConsumption: 0.06,
    minStockThreshold: 0.5,
    targetStock: 2.0,
    allowSubstitutions: true,
    requireApprovalForBrandChange: true,
    lastRestockedDate: '2026-10-05T08:00:00.000Z',
    stockoutDaysCount: 0,
  };

  it('Channel3Adapter sets storeId: "web", extracts real retailer, and maps prices accurately', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            id: 'prod-det-99',
            title: 'Surf Excel Liquid Laundry Detergent',
            brands: [{ id: 'b1', name: 'Surf Excel' }],
            offers: [
              {
                domain: 'dollartree.com',
                price: { price: 4.25, currency: 'USD' },
              },
            ],
            package_size: '2 L',
            in_stock: true,
          },
        ],
      }),
    });

    const adapter = new Channel3Adapter('test-key-123', 'https://api.trychannel3.com/v1/search', mockFetch as any);
    const quotes = await adapter.searchProducts('Surf Excel Liquid Laundry Detergent', 'demo-user');

    expect(quotes.length).toBe(1);
    const q = quotes[0];
    expect(q.name).toBe('Surf Excel Liquid Laundry Detergent');
    expect(q.brand).toBe('Surf Excel');
    expect(q.storeId).toBe('web'); // StoreId must be "web", NEVER a quick-commerce store
    expect(q.retailer).toBe('dollartree.com');
    expect(q.source).toBe('channel3');

    // 4.25 USD * 85 INR/USD * 100 paise = 36125 paise
    const expectedPaise = Math.round(4.25 * USD_TO_INR_RATE * 100);
    expect(q.pricePaise).toBe(expectedPaise);
  });

  it('drops Channel3 results with null, missing, or zero prices', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            id: 'prod-no-price',
            title: 'Surf Excel Detergent Without Price',
            brands: [{ id: 'b1', name: 'Surf Excel' }],
            offers: [
              {
                domain: 'somestore.com',
                price: null,
              },
            ],
          },
        ],
      }),
    });

    const adapter = new Channel3Adapter('test-key-123', 'https://api.trychannel3.com/v1/search', mockFetch as any);
    const quotes = await adapter.searchProducts('Surf Excel Liquid Laundry Detergent', 'demo-user');
    expect(quotes.length).toBe(0); // Dropped!

    const productForPantry = await adapter.getProductForPantryItem(detergentItem, 'demo-user');
    expect(productForPantry).toBeNull(); // Usable product dropped!
  });

  it('drops irrelevant Channel3 results (e.g. wall art for eggs, toner for milk, farm-supply feed for oats)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            id: 'prod-wall-art',
            title: 'Farm Fresh Eggs Wall Art Poster',
            brands: [{ id: 'b2', name: 'Stupell Home Decor' }],
            offers: [{ domain: 'decor.com', price: { price: 29.99, currency: 'USD' } }],
          },
          {
            id: 'prod-feed-oats',
            title: 'Premium Triple Cleaned Whole Oats (Horse & Livestock Feed)',
            brands: [{ id: 'b3', name: 'Sweet Grass' }],
            offers: [{ domain: 'murdochs.com', price: { price: 16.99, currency: 'USD' } }],
          },
        ],
      }),
    });

    const adapter = new Channel3Adapter('test-key-123', 'https://api.trychannel3.com/v1/search', mockFetch as any);
    const eggItem: PantryItem = {
      ...samplePantryItem,
      id: 'item-eggs',
      name: 'Farm Fresh White Eggs',
      category: 'Dairy',
      preferredBrand: 'Eggoz',
    };
    const oatsItem: PantryItem = {
      ...samplePantryItem,
      id: 'item-oats',
      name: 'Rolled Oats Whole Grain',
      category: 'Breakfast & Cereals',
      preferredBrand: 'Quaker',
    };

    // Food items and farm-supply listings are rejected from web quotes
    const eggMatch = await adapter.getProductForPantryItem(eggItem, 'demo-user');
    expect(eggMatch).toBeNull();

    const milkMatch = await adapter.getProductForPantryItem(samplePantryItem, 'demo-user');
    expect(milkMatch).toBeNull();

    const oatsMatch = await adapter.getProductForPantryItem(oatsItem, 'demo-user');
    expect(oatsMatch).toBeNull();
  });

  it('keeps valid non-grocery Channel3 result (detergent, cleaning supplies) labeled storeId: "web"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            id: 'c3-valid-det',
            title: 'Surf Excel Liquid Laundry Detergent',
            brands: [{ id: 'b1', name: 'Surf Excel' }],
            offers: [{ domain: 'dollartree.com', price: { price: 4.25, currency: 'USD' } }],
          },
        ],
      }),
    });

    const adapter = new Channel3Adapter('test-key-123', 'https://api.trychannel3.com/v1/search', mockFetch as any);
    const match = await adapter.getProductForPantryItem(detergentItem, 'demo-user');

    expect(match).not.toBeNull();
    expect(match?.storeId).toBe('web');
    expect(match?.name).toBe('Surf Excel Liquid Laundry Detergent');
    expect(match?.retailer).toBe('dollartree.com');
  });

  it('in hybrid mode, restricts webQuotes strictly to non-grocery items and leaves food items with mock quotes only', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            id: 'c3-valid-det',
            title: 'Surf Excel Liquid Laundry Detergent',
            brands: [{ id: 'b1', name: 'Surf Excel' }],
            offers: [{ domain: 'dollartree.com', price: { price: 4.25, currency: 'USD' } }],
          },
        ],
      }),
    });

    const registry = new ServerAdapterRegistry('hybrid', 'test-api-key', mockFetch as any);
    const { quotes, webQuotes } = await registry.getAllQuotes([samplePantryItem, detergentItem], 'demo-user');

    // 1. webQuotes contains only the non-grocery item (detergent), never food items (milk)
    expect(webQuotes.length).toBe(1);
    expect(webQuotes[0].pantryItemId).toBe('item-detergent');
    expect(webQuotes[0].storeId).toBe('web');
    expect(webQuotes[0].source).toBe('channel3');

    // 2. Quick-commerce quotes used by the optimizer NEVER contain Channel3 or storeId "web"
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.every(q => q.source === 'mock' && q.storeId !== 'web')).toBe(true);
  });

  it('ServerAdapterRegistry returns mock quotes with source: "mock" in mock mode', async () => {
    const registry = new ServerAdapterRegistry('mock', undefined);
    const quotes = await registry.getQuotesForPantryItem(samplePantryItem, 'demo-user');

    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) {
      expect(q.source).toBe('mock');
      expect(q.storeId).not.toBe('web');
    }
  });

  it('ServerAdapterRegistry falls back to mock on Channel3 error and logs warning', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('Channel3 network timeout'));
    const registry = new ServerAdapterRegistry('channel3', 'test-api-key', failingFetch as any);

    const quotes = await registry.getQuotesForPantryItem(detergentItem, 'demo-user');

    // Fell back to mock quotes
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.some(q => q.source === 'mock')).toBe(true);
  });

  it('caches quote results in memory and skips repeated API calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            id: 'c3-det-1',
            title: 'Surf Excel Liquid Laundry Detergent',
            brands: [{ id: 'b1', name: 'Surf Excel' }],
            offers: [{ domain: 'dollartree.com', price: { price: 4.25, currency: 'USD' } }],
          },
        ],
      }),
    });

    const registry = new ServerAdapterRegistry('hybrid', 'test-api-key', mockFetch as any);

    // First call: triggers fetch
    const firstCall = await registry.getQuotesWithWebSeparation(detergentItem, 'demo-user');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(firstCall.webQuotes.length).toBe(1);

    // Second call: served from in-memory cache
    const secondCall = await registry.getQuotesWithWebSeparation(detergentItem, 'demo-user');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Not called again!
    expect(secondCall).toEqual(firstCall);
  });
});
