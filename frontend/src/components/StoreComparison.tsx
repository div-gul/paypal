import React, { useEffect, useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { STORE_DEFINITIONS, MOCK_STORE_CATALOG } from '../adapters/mockStoreData';
import { formatPaise } from '../services/currency';
import { Store, Info, Tag, Radio } from 'lucide-react';
import { StoreId, StoreProduct } from '../types';
import { api } from '../api/client';

export const StoreComparison: React.FC = () => {
  const { pantryItems, setShowDemoInfoModal } = useShopPilot();
  const [catalogItems, setCatalogItems] = useState<StoreProduct[]>(MOCK_STORE_CATALOG);
  const [quoteMode, setQuoteMode] = useState<string>('mock');
  const stores: StoreId[] = ['blinkit', 'zepto', 'instamart'];

  useEffect(() => {
    let isMounted = true;
    api.getQuotes()
      .then(res => {
        if (isMounted && res.quotes && res.quotes.length > 0) {
          setCatalogItems(res.quotes);
          if (res.mode) setQuoteMode(res.mode);
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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              Store Catalogs & Fee Comparison
            </h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                quoteMode === 'channel3'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              {quoteMode === 'channel3' ? 'Live Channel3 Pricing' : 'Mock Store Adapters'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowDemoInfoModal(true)}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
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
              className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{store.name}</h3>
                  <span className="text-[11px] text-slate-500">{store.tagline}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${store.badgeBg}`}>
                  ~{store.estimatedDeliveryMinutes} min
                </span>
              </div>

              {/* Fee Matrix */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>Base Delivery Fee:</span>
                  <span className="font-semibold text-slate-800">
                    {formatPaise(store.deliveryFeeBasePaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Free Delivery Above:</span>
                  <span className="font-semibold text-emerald-700">
                    {formatPaise(store.freeDeliveryThresholdPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Min Order Requirement:</span>
                  <span className="font-semibold text-slate-800">
                    {formatPaise(store.minOrderThresholdPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Handling Fee:</span>
                  <span className="font-semibold text-slate-800">
                    {formatPaise(store.handlingFeePaise)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Cross-Store Price Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3">Household Item</th>
              <th className="p-3">Preferred Brand</th>
              <th className="p-3">Blinkit Price</th>
              <th className="p-3">Zepto Price</th>
              <th className="p-3">Instamart Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
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
                  return <span className="text-slate-400 italic">Unavailable</span>;
                }

                const isLive = product.source === 'channel3';

                return (
                  <div>
                    <div className="flex items-center gap-1.5 font-mono flex-wrap">
                      <span
                        className={`font-bold ${
                          product.pricePaise === minPrice ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-slate-800'
                        }`}
                      >
                        {formatPaise(product.pricePaise)}
                      </span>
                      {product.pricePaise === minPrice && (
                        <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                      )}
                      {/* Quote source badge */}
                      {isLive ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                          <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" /> Live price
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          Simulated
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate max-w-[150px]" title={product.name}>
                      {product.brand} {product.isExactBrandMatch ? '(Match)' : '(Sub)'}
                    </span>
                  </div>
                );
              };

              return (
                <tr key={item.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-semibold text-slate-900">
                    {item.name}
                    <span className="text-[10px] text-slate-400 block font-normal">
                      {item.preferredPackageSize}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">
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
  );
};
