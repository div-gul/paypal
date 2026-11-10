import React, { useEffect, useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { STORE_DEFINITIONS, MOCK_STORE_CATALOG } from '@shared/adapters/mockStoreData';
import { formatPaise } from '../services/currency';
import { Store, Info, Tag } from 'lucide-react';
import { StoreProduct } from '../types';
import { api } from '../api/client';
import { ProductImage } from './ui/ProductImage';

export const StoreComparison: React.FC = () => {
  const { pantryItems, setShowDemoInfoModal } = useShopPilot();
  const [catalogItems, setCatalogItems] = useState<StoreProduct[]>(MOCK_STORE_CATALOG);
  const stores: ('blinkit' | 'zepto' | 'instamart')[] = ['blinkit', 'zepto', 'instamart'];

  useEffect(() => {
    let isMounted = true;
    api.getQuotes()
      .then(res => {
        if (isMounted) {
          if (res.quotes && res.quotes.length > 0) {
            setCatalogItems(res.quotes);
          }
        }
      })
      .catch(() => {
        // Fallback gracefully to default catalog
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-surface rounded-xl border border-secondary-tint p-5 shadow-soft space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-secondary-tint pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Store className="w-5 h-5 text-secondary" />
              Store Catalogs & Fee Comparison
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-secondary-tint text-secondary border-secondary/20">
              Local store adapters
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowDemoInfoModal(true)}
          className="text-xs font-semibold text-secondary hover:text-ink flex items-center gap-1 cursor-pointer transition"
        >
          <Info className="w-3.5 h-3.5" /> Integration Boundaries
        </button>
      </div>

      {/* Store Fee Specs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stores.map(storeId => {
          const store = STORE_DEFINITIONS[storeId];
          return (
            <div
              key={storeId}
              className="bg-paper rounded-xl border border-secondary-tint p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-ink text-sm">{store.name}</h3>
                  <span className="text-[11px] text-ink-muted">{store.tagline}</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand border border-brand/20">
                  ~{store.estimatedDeliveryMinutes} min
                </span>
              </div>

              {/* Fee Matrix */}
              <div className="space-y-1.5 text-xs text-ink-muted pt-2 border-t border-secondary-tint">
                <div className="flex justify-between">
                  <span>Base Delivery Fee:</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatPaise(store.deliveryFeeBasePaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Free Delivery Above:</span>
                  <span className="font-semibold text-good tabular-nums">
                    {formatPaise(store.freeDeliveryThresholdPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Min Order Requirement:</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatPaise(store.minOrderThresholdPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Handling Fee:</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatPaise(store.handlingFeePaise)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Cross-Store Price Comparison Table */}
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-xl border border-secondary-tint">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary-tint/50 text-ink font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3" rowSpan={2}>Household Item</th>
                <th className="p-3" rowSpan={2}>Preferred Brand</th>
                <th className="p-3 text-center" colSpan={3}>Simulated prices</th>
              </tr>
              <tr>
                <th className="p-3">Blinkit</th>
                <th className="p-3">Zepto</th>
                <th className="p-3">Instamart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-tint bg-surface">
              {pantryItems.map(item => {
                const matchedItems = catalogItems.filter(p => p.pantryItemId === item.id);
                const bl = matchedItems.find(p => p.storeId === 'blinkit');
                const zp = matchedItems.find(p => p.storeId === 'zepto');
                const im = matchedItems.find(p => p.storeId === 'instamart');

                // Find lowest price among in-stock options
                const inStockPrices = [bl, zp, im]
                  .filter(p => p && p.inStock)
                  .map(p => p!.pricePaise);
                const minPrice = inStockPrices.length > 0 ? Math.min(...inStockPrices) : Infinity;

                const renderStoreCell = (product?: StoreProduct) => {
                  if (!product) {
                    return <span className="text-ink-muted italic">Unavailable</span>;
                  }

                  const isLowest = product.pricePaise === minPrice;

                  return (
                    <div>
                      <div className="flex items-center gap-1.5 tabular-nums flex-wrap">
                        <span
                          className={`font-semibold ${
                            isLowest ? 'text-good bg-good/10 px-1.5 py-0.5 rounded border border-good/25' : 'text-ink'
                          }`}
                        >
                          {formatPaise(product.pricePaise)}
                        </span>
                        {isLowest && (
                          <Tag className="w-3 h-3 text-good shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-ink-muted block truncate max-w-[150px]" title={product.name}>
                        {product.brand} {product.isExactBrandMatch ? '' : '(sub)'}
                      </span>
                    </div>
                  );
                };

                return (
                  <tr key={item.id} className="hover:bg-paper/50 transition">
                    <td className="p-3 font-semibold text-ink">
                      <div className="flex items-center gap-2.5">
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.name}
                          category={item.category}
                          size="sm"
                          className="w-9 h-9 rounded-lg"
                        />
                        <div>
                          <span>{item.name}</span>
                          <span className="text-[10px] text-ink-muted block font-normal">
                            {item.preferredPackageSize}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-ink-muted">
                      {item.preferredBrand}
                    </td>

                    {/* Blinkit cell */}
                    <td className="p-3">{renderStoreCell(bl)}</td>

                    {/* Zepto cell */}
                    <td className="p-3">{renderStoreCell(zp)}</td>

                    {/* Instamart cell */}
                    <td className="p-3">{renderStoreCell(im)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
