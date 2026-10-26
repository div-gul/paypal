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

  it('Channel3Adapter sends proper headers and maps USD prices to integer Paise', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'prod-milk-99',
            title: 'Amul Taaza Milk 1L',
            brand: 'Amul',
            price: 1.50, // USD
            currency: 'USD',
            package_size: '1 L',
            in_stock: true,
          },
        ],
      }),
    });

    const adapter = new Channel3Adapter('test-key-123', 'https://api.trychannel3.com/v1/search', mockFetch as any);
    const quotes = await adapter.searchProducts('Amul Fresh Toned Milk', 'demo-user');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.trychannel3.com/v1/search');
    expect(options.headers['x-api-key']).toBe('test-key-123');
    expect(options.headers['x-user-id']).toBe('demo-user');

    expect(quotes.length).toBe(1);
    const q = quotes[0];
    expect(q.name).toBe('Amul Taaza Milk 1L');
    expect(q.brand).toBe('Amul');
    expect(q.source).toBe('channel3');

    // 1.50 USD * 85 INR/USD * 100 paise = 12750 paise
    const expectedPaise = Math.round(1.50 * USD_TO_INR_RATE * 100);
    expect(q.pricePaise).toBe(expectedPaise);
  });

  it('ServerAdapterRegistry returns mock quotes with source: "mock" in mock mode', async () => {
    const registry = new ServerAdapterRegistry('mock', undefined);
    const quotes = await registry.getQuotesForPantryItem(samplePantryItem, 'demo-user');

    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) {
      expect(q.source).toBe('mock');
    }
  });

  it('ServerAdapterRegistry falls back to mock on Channel3 error and logs warning', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('Channel3 network timeout'));
    const registry = new ServerAdapterRegistry('channel3', 'test-api-key', failingFetch as any);

    const quotes = await registry.getQuotesForPantryItem(samplePantryItem, 'demo-user');

    // Fell back to mock quotes
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.some(q => q.source === 'mock')).toBe(true);
  });

  it('caches quote results in memory and skips repeated API calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'c3-prod-1',
            name: 'Cached Amul Milk',
            brand: 'Amul',
            price: 68.0,
            currency: 'INR',
          },
        ],
      }),
    });

    const registry = new ServerAdapterRegistry('channel3', 'test-api-key', mockFetch as any);

    // First call: triggers fetch
    const firstCall = await registry.getQuotesForPantryItem(samplePantryItem, 'demo-user');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(firstCall.length).toBe(1);

    // Second call: served from in-memory cache
    const secondCall = await registry.getQuotesForPantryItem(samplePantryItem, 'demo-user');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Not called again!
    expect(secondCall).toEqual(firstCall);
  });
});
