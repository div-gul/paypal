import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import {
  TrendingDown,
  ShoppingBag,
  Store,
  Truck,
  FileCheck2,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const BasketOptimizer: React.FC = () => {
  const {
    optimizationResult,
    selectedStrategyType,
    setSelectedStrategyType,
    openCheckoutModal,
  } = useShopPilot();

  const [showItemDetails, setShowItemDetails] = useState(true);

  if (!optimizationResult || optimizationResult.strategies.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
        No active restock items requiring basket optimization.
      </div>
    );
  }

  const { strategies, recommendedStrategy } = optimizationResult;
  const currentStrategy =
    strategies.find(s => s.type === selectedStrategyType) || recommendedStrategy || strategies[0];

  const allFinalItems = currentStrategy.storeBaskets.flatMap(b =>
    b.items.map(item => ({ ...item, storeName: b.storeName, storeId: b.storeId }))
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-emerald-600" />
              Delivery-Fee-Aware Basket Cost Optimizer
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Integer Paise Precision
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Multi-store final cost evaluation with independent store delivery, handling, and platform charges.
          </p>
        </div>

        <button
          onClick={() => openCheckoutModal(currentStrategy)}
          disabled={currentStrategy.grandTotalPaise === 0}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-paypal-blue via-paypal-lightBlue to-brand-600 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-paypal-blue/20 cursor-pointer disabled:opacity-50 transition"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Checkout Proposed Basket ({formatPaise(currentStrategy.grandTotalPaise)})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Recommended Strategy Highlight Banner */}
      {recommendedStrategy && (
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  Recommended Basket Strategy
                </span>
                <span className="font-bold text-slate-900">{recommendedStrategy.title}</span>
              </div>
              <p className="text-xs text-emerald-900 mt-1 leading-relaxed font-medium">
                {recommendedStrategy.recommendationReason}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-emerald-700 uppercase font-semibold block">Total Payable</span>
            <span className="text-xl font-extrabold text-emerald-900 font-mono">
              {formatPaise(recommendedStrategy.grandTotalPaise)}
            </span>
          </div>
        </div>
      )}

      {/* 4 Strategy Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {strategies.map(strat => {
          const isSelected = strat.type === selectedStrategyType;
          const isRec = strat.type === recommendedStrategy?.type;

          return (
            <div
              key={strat.type}
              onClick={() => setSelectedStrategyType(strat.type)}
              className={`rounded-xl border p-4 cursor-pointer transition flex flex-col justify-between ${
                isSelected
                  ? 'border-brand-600 bg-brand-50/20 ring-2 ring-brand-500/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div>
                {/* Header Tag */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {strat.tag}
                  </span>
                  {isRec && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ★ Best Choice
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-xs mb-1 leading-snug">{strat.title}</h3>
                <p className="text-[11px] text-slate-500 leading-tight mb-3 line-clamp-2">
                  {strat.description}
                </p>

                {/* Granular Cost Summary */}
                <div className="space-y-1.5 text-[11px] py-2 border-t border-b border-slate-100 text-slate-600">
                  <div className="flex justify-between">
                    <span>Products Subtotal</span>
                    <span className="font-medium text-slate-800">{formatPaise(strat.totalProductPaise)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Delivery Fees
                    </span>
                    <span className="font-semibold">{formatPaise(strat.totalDeliveryFeePaise)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Platform / Taxes</span>
                    <span>{formatPaise(strat.totalHandlingFeePaise + strat.totalTaxPaise)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Store Orders</span>
                    <span>{strat.storesInvolvedCount} order{strat.storesInvolvedCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>

              {/* Total Card Footer */}
              <div className="pt-3 flex items-baseline justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Cost</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {formatPaise(strat.grandTotalPaise)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DEDICATED: Complete Consolidated Final Basket Items View */}
      <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-brand-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Final Proposed Basket Items ({allFinalItems.length} Products • {allFinalItems.reduce((acc, i) => acc + i.quantity, 0)} Units)
              </h3>
              <p className="text-[11px] text-slate-500">
                All products selected for purchase under <strong>{currentStrategy.title}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-semibold bg-white px-2.5 py-1 rounded-md border border-slate-200 font-mono">
              Items: {formatPaise(currentStrategy.totalProductPaise)} + Fees: {formatPaise(currentStrategy.totalDeliveryFeePaise + currentStrategy.totalHandlingFeePaise + currentStrategy.totalTaxPaise)} = <strong className="text-emerald-700">{formatPaise(currentStrategy.grandTotalPaise)}</strong>
            </span>
            <button
              onClick={() => setShowItemDetails(!showItemDetails)}
              className="p-1 rounded-md hover:bg-slate-200 text-slate-600 cursor-pointer"
              title="Toggle itemized table view"
            >
              {showItemDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showItemDetails && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Fulfillment Store</th>
                  <th className="py-2.5 px-3">Package / SKU</th>
                  <th className="py-2.5 px-3">Brand Match</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allFinalItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                      No items in this basket strategy. Approve low or urgent pantry items to populate the basket.
                    </td>
                  </tr>
                ) : (
                  allFinalItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.product.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-800 border border-slate-200">
                          {item.storeName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {item.product.packageSize}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            !item.isSubstitution
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {!item.isSubstitution ? 'Exact Match' : 'Substitute Brand'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatPaise(item.product.pricePaise)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-mono">
                        {item.quantity}x
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatPaise(item.totalPaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Strategy Store Orders Breakdown */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Fulfillment Orders Breakdown ({currentStrategy.storeBaskets.length} Separate Store Order{currentStrategy.storeBaskets.length === 1 ? '' : 's'})
            </h3>
          </div>
          <div className="text-xs text-slate-500">
            Order-level fees calculated <strong>independently</strong> for each store
          </div>
        </div>

        {/* Store Sub-Baskets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentStrategy.storeBaskets.map(basket => (
            <div key={basket.storeId} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
              {/* Store Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">{basket.storeName}</h4>
                  <span className="text-[10px] text-slate-400">
                    {basket.items.length} item{basket.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  {formatPaise(basket.totalPaise)}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 divide-y divide-slate-100">
                {basket.items.map(item => (
                  <div key={item.product.id} className="pt-1.5 first:pt-0 text-[11px] flex items-center justify-between gap-1 text-slate-700">
                    <div className="truncate pr-1">
                      <span className="font-semibold text-slate-900">{item.quantity}x</span> {item.product.name}
                      <span className="text-[10px] text-slate-400 block">{item.product.brand} ({item.product.packageSize})</span>
                    </div>
                    <span className="font-semibold text-slate-900 font-mono shrink-0">
                      {formatPaise(item.totalPaise)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Fee Breakdown per Store Order */}
              <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1 text-slate-500">
                <div className="flex justify-between">
                  <span>Product Subtotal</span>
                  <span>{formatPaise(basket.productSubtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Delivery Fee</span>
                  <span>{formatPaise(basket.deliveryFeePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Handling Fee</span>
                  <span>{formatPaise(basket.handlingFeePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (GST 5%)</span>
                  <span>{formatPaise(basket.taxPaise)}</span>
                </div>
                {basket.minOrderShortfallPaise > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Min Order Shortfall</span>
                    <span>+{formatPaise(basket.minOrderShortfallPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-[11px] pt-1 border-t border-slate-200">
                  <span>Store Total</span>
                  <span>{formatPaise(basket.totalPaise)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Grand Total Summary */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Autonomous policy verified: No duplicate delivery fees, user preferences respected.</span>
          </div>

          <button
            onClick={() => openCheckoutModal(currentStrategy)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Review & Proceed to Checkout ({formatPaise(currentStrategy.grandTotalPaise)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
