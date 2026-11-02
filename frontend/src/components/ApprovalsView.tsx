import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import { Card, Button, Badge, EmptyState } from './ui';
import {
  CheckCircle2,
  RefreshCw,
  Check,
  X,
  Plus,
  Trash2,
  ShoppingBag,
  Clock,
  Calendar,
} from 'lucide-react';

export const ApprovalsView: React.FC = () => {
  const {
    pantryItems,
    upcomingOrder,
    pendingSwaps,
    updateOrderItemQty,
    removeOrderItemFromBucket,
    addOrderItemToBucket,
    saveUpcomingOrder,
    approveSwap,
    rejectSwap,
    isUpcomingOrderSaved,
  } = useShopPilot();

  const [selectedPantryIdToAdd, setSelectedPantryIdToAdd] = useState<string>('');
  // Available pantry items that can be added to the upcoming order
  const existingItemIds = new Set(upcomingOrder.items.map(i => i.pantryItemId));
  const addablePantryItems = pantryItems.filter(p => !existingItemIds.has(p.id));

  const handleAddSelected = () => {
    if (!selectedPantryIdToAdd) return;
    addOrderItemToBucket(selectedPantryIdToAdd);
    setSelectedPantryIdToAdd('');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto font-sans pb-10">
      {/* Top Banner */}
      <div className="border-b border-slate-200/80 pb-4">
        <h2 className="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
          <span>Approvals & Restock Orders</span>
          {pendingSwaps.length > 0 && (
            <Badge variant="warning" size="sm">
              {pendingSwaps.length} swap{pendingSwaps.length === 1 ? '' : 's'} waiting
            </Badge>
          )}
          {isUpcomingOrderSaved ? (
            <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
              Order Saved
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" icon={<Clock className="w-3 h-3" />}>
              Order Under Review
            </Badge>
          )}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          ShopPilot restocks autonomously with only two approval types: review product substitutions below,
          or modify and approve your consolidated upcoming order bucket.
        </p>
      </div>

      {/* SECTION 1: PENDING PRODUCT SWAP APPROVALS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <span>1. Pending Swap Approvals</span>
              {pendingSwaps.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {pendingSwaps.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Brand replacements suggested when preferred brands are out of stock or optimized.
            </p>
          </div>
        </div>

        {pendingSwaps.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            title="All preferred brands matched"
            description="No pending product swaps. All items in your upcoming order match your preferred household brands."
          />
        ) : (
          <div className="space-y-3.5">
            {pendingSwaps.map(swap => {
              const isSavings = swap.priceDifferencePaise < 0;

              return (
                <Card
                  key={swap.id}
                  variant="elevated"
                  className="border-amber-200 bg-white space-y-3.5 p-4 sm:p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Product comparison details */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{swap.itemName}</span>
                        <Badge variant="warning" size="sm" icon={<RefreshCw className="w-3 h-3" />}>
                          Brand Swap Request
                        </Badge>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-600">
                          Pack: <strong>{swap.packageSize}</strong> • Qty: <strong>{swap.quantity}x</strong>
                        </span>
                      </div>

                      {/* Side-by-side comparison box */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 text-xs">
                        {/* Original Product */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Original Product
                          </span>
                          <div className="font-semibold text-slate-900">{swap.originalProduct.name}</div>
                          <div className="text-slate-500 text-[11px] flex items-center justify-between">
                            <span>Brand: <strong className="text-slate-700">{swap.originalProduct.brand}</strong></span>
                            <span className="font-mono text-slate-700">{formatPaise(swap.originalPricePaise)}</span>
                          </div>
                        </div>

                        {/* Suggested Replacement */}
                        <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                            Suggested Replacement
                          </span>
                          <div className="font-semibold text-slate-900">{swap.replacementProduct.name}</div>
                          <div className="text-slate-500 text-[11px] flex items-center justify-between">
                            <span>Brand: <strong className="text-slate-700">{swap.replacementProduct.brand}</strong></span>
                            <span className="font-mono font-bold text-slate-900">{formatPaise(swap.replacementPricePaise)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Price diff & reason */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Price difference:</span>
                          <span
                            className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                              isSavings
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {isSavings
                              ? `Saves ${formatPaise(Math.abs(swap.priceDifferencePaise))}`
                              : `+${formatPaise(swap.priceDifferencePaise)}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 italic">
                          Reason: {swap.reason}
                        </span>
                      </div>
                    </div>

                    {/* Right: Approve or Reject Actions */}
                    <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-end pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approveSwap(swap.pantryItemId)}
                        icon={<Check className="w-3.5 h-3.5" />}
                        className="w-full sm:w-auto"
                      >
                        Approve Swap
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => rejectSwap(swap.pantryItemId)}
                        icon={<X className="w-3.5 h-3.5 text-slate-500" />}
                        className="w-full sm:w-auto"
                      >
                        Reject Swap
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: CONSOLIDATED UPCOMING WEEKLY ORDER */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-brand-600" />
              <span>2. Upcoming Weekly Order</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 border border-brand-200">
                {upcomingOrder.items.length} product{upcomingOrder.items.length === 1 ? '' : 's'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
          One consolidated bucket scheduled for {upcomingOrder.scheduledDate}. You can adjust quantities,
              add or remove items, save it, and pay from Home.
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Scheduled Run</span>
            <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              {upcomingOrder.scheduledDate}
            </span>
          </div>
        </div>

        {/* Saved order confirmation */}
        {isUpcomingOrderSaved && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-950">
                  Order Saved
                </h4>
                <p className="text-xs text-emerald-800">
                  Saved for {upcomingOrder.scheduledDate}. You can continue editing; Home reflects changes immediately.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* Add Product Toolbar (Active when order is under review) */}
        {addablePantryItems.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-brand-600" /> Add Product to Order:
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <select
                value={selectedPantryIdToAdd}
                onChange={e => setSelectedPantryIdToAdd(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="">Select a pantry item to add...</option>
                {addablePantryItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.preferredBrand}) - {item.currentQuantity} {item.unit} in pantry
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                disabled={!selectedPantryIdToAdd}
                onClick={handleAddSelected}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Order Items List */}
        {upcomingOrder.items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-5 h-5 text-slate-400" />}
            title="Your upcoming order bucket is empty"
            description="Pantry stock is healthy. When items deplete or advance in time, required items will be added here."
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {upcomingOrder.items.map(item => {
              const isModified = item.isUserModified && item.quantity !== item.suggestedQuantity;

              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                >
                  {/* Left: Product & Brand Details */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{item.product.name}</h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 capitalize">
                        {item.product.storeId}
                      </span>
                      {item.isSubstitution && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                          Replacement Brand
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span>Brand: <strong className="text-slate-700">{item.product.brand}</strong></span>
                      <span>•</span>
                      <span>Pack: <strong>{item.packageSize}</strong></span>
                      <span>•</span>
                      <span>Unit Price: <strong className="font-mono text-slate-700">{formatPaise(item.unitPricePaise)}</strong></span>
                      {isModified && (
                        <span className="text-[10px] text-brand-800 bg-brand-50 px-2 py-0.2 rounded font-semibold border border-brand-200">
                          User set: {item.quantity} • AI suggested: {item.suggestedQuantity}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Immediate Quantity Adjuster */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        disabled={item.quantity <= 1}
                        onClick={() => updateOrderItemQty(item.id, -1)}
                        title="Decrease quantity by 1"
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 font-extrabold text-sm flex items-center justify-center cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      >
                        -
                      </button>
                      <span className="min-w-[42px] text-center font-bold text-slate-900 text-xs font-mono">
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        onClick={() => updateOrderItemQty(item.id, 1)}
                        title="Increase quantity by 1"
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 font-extrabold text-sm flex items-center justify-center cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="w-24 text-right">
                      <span className="font-extrabold text-slate-900 text-sm font-mono block">
                        {formatPaise(item.totalPricePaise)}
                      </span>
                    </div>

                    {/* Delete Item */}
                    <button
                      onClick={() => removeOrderItemFromBucket(item.id)}
                      title="Remove product from this order"
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Order Totals & Single Approve Action Footer */}
            <div className="p-5 bg-slate-50/80 border-t border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 text-slate-600">
                  <div className="flex items-center gap-4">
                    <span>Products Subtotal:</span>
                    <strong className="font-mono text-slate-800">{formatPaise(upcomingOrder.subtotalPaise)}</strong>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Store Delivery:</span>
                    <strong className="font-mono text-emerald-700">
                      {upcomingOrder.deliveryFeePaise === 0 ? 'FREE' : formatPaise(upcomingOrder.deliveryFeePaise)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 sm:text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Total Order Cost:</span>
                  <span className="text-2xl font-extrabold text-slate-900 font-mono">
                    {formatPaise(upcomingOrder.totalPaise)}
                  </span>
                </div>
              </div>

              {/* Single Consolidated Approval Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={upcomingOrder.items.length === 0}
                    onClick={saveUpcomingOrder}
                    icon={<Check className="w-4 h-4" />}
                    className="w-full sm:w-auto"
                  >
                    Save Order ({formatPaise(upcomingOrder.totalPaise)})
                  </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
