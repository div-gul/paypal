import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import { ProductCategory, UnitOfMeasurement } from '@shared/types';
import { Card, Button, Badge, EmptyState, ProductImage } from './ui';
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
    addNewPantryItemToOrder,
    saveUpcomingOrder,
    approveSwap,
    rejectSwap,
    isUpcomingOrderSaved,
  } = useShopPilot();

  const [selectedPantryIdToAdd, setSelectedPantryIdToAdd] = useState<string>('');
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ProductCategory>('Snacks');
  const [newItemBrand, setNewItemBrand] = useState('Generic');
  const [newItemPackage, setNewItemPackage] = useState('1 pack');
  const [newItemUnit, setNewItemUnit] = useState<UnitOfMeasurement>('packs');
  // Available pantry items that can be added to the upcoming order
  const existingItemIds = new Set(upcomingOrder.items.map(i => i.pantryItemId));
  const addablePantryItems = pantryItems.filter(p => !existingItemIds.has(p.id));

  const handleAddSelected = () => {
    if (!selectedPantryIdToAdd) return;
    addOrderItemToBucket(selectedPantryIdToAdd);
    setSelectedPantryIdToAdd('');
  };

  const handleAddNewItem = async () => {
    const name = newItemName.trim();
    if (!name) return;
    await addNewPantryItemToOrder({
      name,
      category: newItemCategory,
      preferredBrand: newItemBrand.trim() || 'Generic',
      preferredPackageSize: newItemPackage.trim() || `1 ${newItemUnit}`,
      unit: newItemUnit,
      currentQuantity: 1,
      averageDailyConsumption: 0,
      minStockThreshold: 0,
      targetStock: 1,
      allowSubstitutions: false,
      requireApprovalForBrandChange: false,
      quantityStep: ['pcs', 'packs', 'units', 'eggs'].includes(newItemUnit) ? 1 : 0.5,
      allowFractions: !['pcs', 'packs', 'units', 'eggs'].includes(newItemUnit),
    });
    setNewItemName('');
    setIsAddingNewItem(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto font-sans pb-24 md:pb-10">
      {/* Top Banner */}
      <div className="border-b border-secondary-tint pb-4">
        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
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
      </div>

      {/* SECTION 1: PENDING PRODUCT SWAP APPROVALS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-secondary" />
              <span>1. Pending Swap Approvals</span>
              {pendingSwaps.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-tint text-accent-dark border border-accent/20">
                  {pendingSwaps.length}
                </span>
              )}
            </h3>
          </div>
        </div>

        {pendingSwaps.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-5 h-5 text-good" />}
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
                  className="border-secondary-tint bg-surface space-y-3.5 p-4 sm:p-5 shadow-soft"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Product comparison details */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink text-sm">{swap.itemName}</span>
                        <Badge variant="warning" size="sm" icon={<RefreshCw className="w-3 h-3" />}>
                          Brand Swap Request
                        </Badge>
                        <span className="text-xs text-ink-muted">•</span>
                        <span className="text-xs text-ink-muted">
                          Pack: <strong className="text-ink">{swap.packageSize}</strong> • Qty: <strong className="text-ink">{swap.quantity}x</strong>
                        </span>
                      </div>

                      {/* Side-by-side comparison cards (Suggested one highlighted) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Original Product (Neutral) */}
                        <div className="flex items-center gap-3 bg-paper border border-secondary-tint rounded-xl p-3">
                          <ProductImage
                            src={swap.originalProduct.imageUrl}
                            alt={swap.originalProduct.name}
                            size="md"
                            className="shrink-0 rounded-lg"
                          />
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="font-semibold text-ink truncate text-xs">
                              {swap.originalProduct.name}
                            </div>
                            <div className="text-ink-muted font-bold text-xs tabular-nums">
                              {formatPaise(swap.originalPricePaise)}
                            </div>
                          </div>
                        </div>

                        {/* Suggested Replacement (Highlighted) */}
                        <div className="flex items-center gap-3 bg-brand-tint/60 border-2 border-brand rounded-xl p-3 shadow-xs">
                          <ProductImage
                            src={swap.replacementProduct.imageUrl}
                            alt={swap.replacementProduct.name}
                            size="md"
                            className="shrink-0 rounded-lg border border-brand/20"
                          />
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="font-bold text-brand truncate text-xs">
                              {swap.replacementProduct.name}
                            </div>
                            <div className="text-brand font-black text-xs tabular-nums">
                              {formatPaise(swap.replacementPricePaise)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Price diff */}
                      <div className="flex items-center gap-2 text-xs pt-0.5">
                        <span className="text-ink-muted">Price difference:</span>
                        <span
                          className={`font-semibold tabular-nums px-2 py-0.5 rounded text-[11px] ${
                            isSavings
                              ? 'bg-good/15 text-good border border-good/30'
                              : 'bg-secondary-tint text-secondary border border-secondary/20'
                          }`}
                        >
                          {isSavings
                            ? `Saves ${formatPaise(Math.abs(swap.priceDifferencePaise))}`
                            : `+${formatPaise(swap.priceDifferencePaise)}`}
                        </span>
                      </div>
                    </div>

                    {/* Right: Approve (Orange) or Reject (Outline) Actions */}
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
                        variant="outline"
                        size="sm"
                        onClick={() => rejectSwap(swap.pantryItemId)}
                        icon={<X className="w-3.5 h-3.5 text-ink-muted" />}
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
      <section className="space-y-4 pt-4 border-t border-secondary-tint">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-brand" />
              <span>2. Upcoming Weekly Order</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand border border-brand/20">
                {upcomingOrder.items.length} product{upcomingOrder.items.length === 1 ? '' : 's'}
              </span>
            </h3>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Scheduled Run</span>
            <span className="text-xs font-bold text-ink bg-paper border border-secondary-tint px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              {upcomingOrder.scheduledDate}
            </span>
          </div>
        </div>

        {/* Saved order confirmation */}
        {isUpcomingOrderSaved && (
          <div className="bg-good/15 border border-good/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-good">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-good text-white flex items-center justify-center shrink-0 shadow-soft">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-good">
                  Order Saved for {upcomingOrder.scheduledDate}
                </h4>
              </div>
            </div>
          </div>
        )}

        {/* Add Product Toolbar (Active when order is under review) */}
        <div className="bg-surface rounded-xl border border-secondary-tint p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs shadow-soft">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-brand" /> Add Product to Order:
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              {addablePantryItems.length > 0 ? <>
                <select
                  value={selectedPantryIdToAdd}
                  onChange={e => setSelectedPantryIdToAdd(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-secondary-tint bg-surface text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer min-h-[44px]"
                >
                  <option value="">Select a pantry item to add...</option>
                  {addablePantryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.preferredBrand}) - {item.currentQuantity} {item.unit} in pantry
                    </option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" disabled={!selectedPantryIdToAdd} onClick={handleAddSelected} icon={<Plus className="w-3.5 h-3.5" />}>
                  Add
                </Button>
              </> : <span className="text-ink-muted">All pantry items are already in this order.</span>}
              <Button variant="secondary" size="sm" onClick={() => setIsAddingNewItem(value => !value)} icon={<Plus className="w-3.5 h-3.5" />}>
                New Item
              </Button>
            </div>
            {isAddingNewItem && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full pt-2 border-t border-secondary-tint">
                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item name" className="px-3 py-2 rounded-lg border border-secondary-tint bg-surface" />
                <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value as ProductCategory)} className="px-3 py-2 rounded-lg border border-secondary-tint bg-surface">
                  {['Dairy', 'Bakery & Bread', 'Fresh Produce', 'Beverages', 'Pantry Staples', 'Breakfast & Cereals', 'Snacks', 'Personal Care'].map(category => <option key={category}>{category}</option>)}
                </select>
                <input value={newItemBrand} onChange={e => setNewItemBrand(e.target.value)} placeholder="Brand" className="px-3 py-2 rounded-lg border border-secondary-tint bg-surface" />
                <div className="flex gap-2">
                  <input value={newItemPackage} onChange={e => setNewItemPackage(e.target.value)} placeholder="Pack size" className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-secondary-tint bg-surface" />
                  <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value as UnitOfMeasurement)} className="w-24 px-2 py-2 rounded-lg border border-secondary-tint bg-surface">
                    {['L', 'kg', 'g', 'ml', 'packs', 'pcs', 'units', 'eggs'].map(unit => <option key={unit}>{unit}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <Button variant="primary" size="sm" disabled={!newItemName.trim()} onClick={() => void handleAddNewItem()} icon={<Plus className="w-3.5 h-3.5" />}>
                    Add to Order
                  </Button>
                </div>
              </div>
            )}
        </div>

        {/* Order Items List */}
        {upcomingOrder.items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-5 h-5 text-ink-muted" />}
            title="Your upcoming order bucket is empty"
            description="Pantry stock is healthy. When items deplete or advance in time, required items will be added here."
          />
        ) : (
          <div className="bg-surface rounded-xl border border-secondary-tint overflow-hidden shadow-soft divide-y divide-secondary-tint">
            {upcomingOrder.items.map(item => {
              const isModified = item.isUserModified && item.quantity !== item.suggestedQuantity;

              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/40 transition"
                >
                  {/* Left: Product & Brand Details with Image */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ProductImage
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      size="md"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-ink text-sm">{item.product.name}</h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-secondary-tint text-secondary capitalize">
                          {item.product.storeId}
                        </span>
                        {item.isSubstitution && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-secondary-tint text-secondary border border-secondary/20">
                            Replacement Brand
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-ink-muted flex flex-wrap items-center gap-2">
                        <span>Brand: <strong className="text-ink">{item.product.brand}</strong></span>
                        <span>•</span>
                        <span>Pack: <strong className="text-ink">{item.packageSize}</strong></span>
                        <span>•</span>
                        <span>Unit Price: <strong className="text-ink tabular-nums">{formatPaise(item.unitPricePaise)}</strong></span>
                        {(upcomingOrder.paidQuantities?.[item.pantryItemId] || 0) > 0 && (
                          <span>Paid: <strong className="text-good">{upcomingOrder.paidQuantities?.[item.pantryItemId]} {item.unit}</strong></span>
                        )}
                        {isModified && (
                          <span className="text-[10px] text-brand bg-brand-tint px-2 py-0.5 rounded font-semibold border border-brand/20">
                            User set: {item.quantity} • AI suggested: {item.suggestedQuantity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Immediate Quantity Adjuster */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 bg-paper p-1 rounded-xl border border-secondary-tint">
                      <button
                        disabled={item.quantity <= Math.max(1, upcomingOrder.paidQuantities?.[item.pantryItemId] || 0)}
                        onClick={() => updateOrderItemQty(item.id, -1)}
                        title="Decrease quantity by 1"
                        className="w-8 h-8 rounded-lg bg-surface hover:bg-secondary-tint active:bg-secondary-tint/80 border border-secondary-tint text-ink font-bold text-sm flex items-center justify-center cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shadow-soft"
                      >
                        -
                      </button>
                      <span className="min-w-[44px] text-center font-bold text-ink text-xs tabular-nums">
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        onClick={() => updateOrderItemQty(item.id, 1)}
                        title="Increase quantity by 1"
                        className="w-8 h-8 rounded-lg bg-surface hover:bg-secondary-tint active:bg-secondary-tint/80 border border-secondary-tint text-ink font-bold text-sm flex items-center justify-center cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shadow-soft"
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="w-24 text-right">
                      <span className="font-bold text-ink text-sm tabular-nums block">
                        {formatPaise(item.totalPricePaise)}
                      </span>
                    </div>

                    {/* Delete Item */}
                    <button
                      disabled={(upcomingOrder.paidQuantities?.[item.pantryItemId] || 0) > 0}
                      onClick={() => removeOrderItemFromBucket(item.id)}
                      title="Remove product from this order"
                      className="text-ink-muted hover:text-danger p-2 rounded-lg hover:bg-danger/10 cursor-pointer transition min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Order Totals & Approve/Save Action Footer */}
            <div className="p-5 bg-paper border-t border-secondary-tint space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 text-ink-muted">
                  <div className="flex items-center gap-4">
                    <span>Products Subtotal:</span>
                    <strong className="text-ink tabular-nums">{formatPaise(upcomingOrder.subtotalPaise)}</strong>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Store Delivery:</span>
                    <strong className="text-good tabular-nums">
                      {upcomingOrder.deliveryFeePaise === 0 ? 'FREE' : formatPaise(upcomingOrder.deliveryFeePaise)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 sm:text-right">
                  <span className="text-xs text-ink-muted uppercase font-semibold">Total Order Cost:</span>
                  <span className="text-2xl font-bold text-ink tabular-nums">
                    {formatPaise(upcomingOrder.totalPaise)}
                  </span>
                </div>
              </div>

              {/* Desktop Action Area */}
              <div className="hidden md:flex items-center justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  disabled={upcomingOrder.items.length === 0 || isUpcomingOrderSaved}
                  onClick={saveUpcomingOrder}
                  icon={<Check className="w-4 h-4" />}
                >
                  {upcomingOrder.paidAt ? `Save Changes (${formatPaise(upcomingOrder.totalPaise)})` : `Save and Approve Order (${formatPaise(upcomingOrder.totalPaise)})`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Mobile Pinned Bottom Approve Bar */}
      {upcomingOrder.items.length > 0 && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 p-3 bg-surface border-t border-secondary-tint shadow-card z-30">
          <Button
            variant="primary"
            size="md"
            disabled={upcomingOrder.items.length === 0 || isUpcomingOrderSaved}
            onClick={saveUpcomingOrder}
            icon={<Check className="w-4 h-4" />}
            className="w-full"
          >
            {upcomingOrder.paidAt ? `Save Changes (${formatPaise(upcomingOrder.totalPaise)})` : `Save and Approve Order (${formatPaise(upcomingOrder.totalPaise)})`}
          </Button>
        </div>
      )}
    </div>
  );
};
