import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import { filterAndRankStrategies } from '../lib/labels';
import { Card, Button } from './ui';
import { StoreComparison } from './StoreComparison';
import {
  Sparkles,
  ShoppingBag,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Calendar,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export interface HomeViewProps {
  onNavigateToTab: (tab: 'home' | 'approvals' | 'pantry' | 'settings') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigateToTab }) => {
  const {
    pantryItems,
    schedulerConfig,
    recommendations,
    optimizationResult,
    selectedStrategyType,
    setSelectedStrategyType,
    openCheckoutModal,
    activeRun,
    upcomingOrder,
    pendingSwaps,
    isUpcomingOrderSaved,
  } = useShopPilot();

  const [isWhyThisOpen, setIsWhyThisOpen] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<string | null>(null);

  // 1. Calculate next shopping run date & day
  const nextRunDate = new Date(schedulerConfig.nextShoppingDate);
  const nextRunDayName = nextRunDate.toLocaleDateString('en-IN', { weekday: 'long' });

  // 2. Pending approvals check
  const hasPendingSwaps = pendingSwaps.length > 0;
  const needsApproval = hasPendingSwaps || !isUpcomingOrderSaved;

  // 3. Recommended & filtered strategies
  const strategies = optimizationResult?.strategies || [];
  const recommendedStrategy = optimizationResult?.recommendedStrategy;
  const filteredStrategies = filterAndRankStrategies(
    strategies,
    recommendedStrategy,
    recommendations.length
  );

  const currentStrategy =
    filteredStrategies.find(s => s.type === selectedStrategyType) ||
    filteredStrategies.find(s => s.type === recommendedStrategy?.type) ||
    filteredStrategies[0] ||
    recommendedStrategy ||
    strategies[0];

  const allFinalItems = upcomingOrder.items.filter(item => item.quantity > 0).map(item => ({
    product: item.product,
    pantryItemId: item.pantryItemId,
    quantity: item.quantity,
    totalPaise: item.totalPricePaise,
    isSubstitution: Boolean(item.isSubstitution),
    storeName: currentStrategy?.storeBaskets.find(b => b.storeId === item.product.storeId)?.storeName || item.product.storeId,
    storeId: item.product.storeId,
  }));

  const grandTotalPaise = upcomingOrder.totalPaise || currentStrategy?.grandTotalPaise || 0;
  const checkoutStrategy = currentStrategy ? {
    ...currentStrategy,
    grandTotalPaise,
    totalProductPaise: upcomingOrder.subtotalPaise,
    totalDeliveryFeePaise: upcomingOrder.deliveryFeePaise,
    storeBaskets: currentStrategy.storeBaskets.map(basket => {
      const items = allFinalItems
        .filter(item => item.storeId === basket.storeId)
        .map(({ storeName: _storeName, storeId: _storeId, ...item }) => item);
      const productSubtotalPaise = items.reduce((total, item) => total + item.totalPaise, 0);
      const totalPaise = productSubtotalPaise + basket.deliveryFeePaise + basket.handlingFeePaise + basket.taxPaise - basket.discountsPaise;
      return { ...basket, items, productSubtotalPaise, totalPaise };
    }),
  } : undefined;
  const isBudgetSafe = grandTotalPaise <= schedulerConfig.perCycleBudgetPaise;

  // 4. Pantry health calculation
  let wellStockedCount = 0;
  let runningLowCount = 0;
  let ranOutCount = 0;

  pantryItems.forEach(item => {
    if (item.currentQuantity <= 0) {
      ranOutCount++;
    } else {
      const days = item.averageDailyConsumption > 0 ? item.currentQuantity / item.averageDailyConsumption : 99;
      if (days <= schedulerConfig.urgentThresholdDays) {
        runningLowCount++;
      } else {
        wellStockedCount++;
      }
    }
  });

  const totalPantry = Math.max(1, pantryItems.length);
  const wellStockedPct = Math.round((wellStockedCount / totalPantry) * 100);
  const runningLowPct = Math.round((runningLowCount / totalPantry) * 100);
  const ranOutPct = Math.round((ranOutCount / totalPantry) * 100);

  // 5. Deferred items
  const deferredRecs = recommendations.filter(r => r.outcome === 'WAIT_UNTIL_NEXT_CYCLE');

  // Primary store involved
  const primaryStoreName = currentStrategy?.storeBaskets?.[0]?.storeName || 'Local Store';
  const storesCount = currentStrategy?.storeBaskets?.length || 1;

  // 6. Dynamic Household Status Sentence
  const getStatusSentence = () => {
    if (activeRun?.status === 'paid') {
      return 'Order placed and paid via PayPal — your pantry is fully restocked!';
    }
    if (hasPendingSwaps) {
      return `${pendingSwaps.length} product swap${pendingSwaps.length === 1 ? '' : 's'} waiting for your approval in Approvals tab.`;
    }
    if (isUpcomingOrderSaved) {
      return `Order saved for ${upcomingOrder.scheduledDate} — ${upcomingOrder.items.length} items (${formatPaise(upcomingOrder.totalPaise)}). You can keep editing it in Approvals.`;
    }
    if (upcomingOrder.items.length === 0) {
      return `Pantry is well-stocked — next automatic check on ${nextRunDayName}.`;
    }
    const effectiveTotal = upcomingOrder.totalPaise || grandTotalPaise;
    return `Upcoming order ready for ${nextRunDayName} — ${upcomingOrder.items.length} items (${formatPaise(effectiveTotal)}), ${
      isBudgetSafe ? 'comfortably within your budget' : 'reaches your budget limit'
    }.`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Status Sentence Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${
          needsApproval
            ? 'bg-amber-50/70 border-amber-300 text-amber-950'
            : activeRun?.status === 'paid' || isUpcomingOrderSaved
            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              needsApproval
                ? 'bg-amber-200/80 text-amber-900'
                : activeRun?.status === 'paid' || isUpcomingOrderSaved
                ? 'bg-emerald-200/80 text-emerald-900'
                : 'bg-brand-100 text-brand-800'
            }`}
          >
            {needsApproval ? (
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            ) : activeRun?.status === 'paid' || isUpcomingOrderSaved ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            ) : (
              <Sparkles className="w-5 h-5 text-brand-600" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Household Status
            </span>
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {getStatusSentence()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {needsApproval && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateToTab('approvals')}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {hasPendingSwaps ? `Approve Swaps (${pendingSwaps.length})` : 'Review & Save Order'}
            </Button>
          )}
          <Button
            variant="success"
            size="sm"
            disabled={!isUpcomingOrderSaved || upcomingOrder.items.length === 0 || !checkoutStrategy}
            onClick={() => checkoutStrategy && openCheckoutModal(checkoutStrategy)}
            icon={<ShoppingBag className="w-3.5 h-3.5" />}
            title={!isUpcomingOrderSaved ? 'Save the order in Approvals before paying' : undefined}
            className="disabled:bg-emerald-200 disabled:text-emerald-800"
          >
            Confirm and Pay for Order
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Grid: Recommended Order Card + Pantry Health Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Recommended Order Hero Card */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="elevated" className="border-slate-200 p-6 space-y-5">
            {/* Order Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 tracking-wider">
                    Recommended Order
                  </span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Scheduled for {nextRunDayName}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-heading mt-1">
                  {storesCount === 1 ? `${primaryStoreName} Consolidated Order` : `Multi-Store Split (${storesCount} Stores)`}
                </h3>
              </div>

              {/* Price & Delivery pill */}
              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Payable</span>
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {formatPaise(grandTotalPaise)}
                </span>
              </div>
            </div>

            {/* Quick Order Stats */}
            <div className="grid grid-cols-3 gap-3 py-1 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Items to Buy</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {allFinalItems.length} <span className="text-xs font-normal text-slate-500">products</span>
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Delivery Time</span>
                <span className="text-base font-bold text-slate-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" /> ~10 min
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Budget Limit</span>
                <span className="text-base font-bold text-emerald-700 tabular-nums">
                  {formatPaise(schedulerConfig.perCycleBudgetPaise)}
                </span>
              </div>
            </div>

            {/* Restock Item Chips */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Included In This Order:</span>
                <span className="text-[11px] text-slate-400">Click any item for details</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {allFinalItems.map(item => {
                  const isSelected = selectedItemDetail === item.product.id;
                  return (
                    <button
                      key={item.product.id}
                      onClick={() => setSelectedItemDetail(isSelected ? null : item.product.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500 text-brand-900 ring-2 ring-brand-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span>{item.quantity}x {item.product.name}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">({formatPaise(item.totalPaise)})</span>
                      {item.isSubstitution && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" title="Substituted brand" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Item Detail Popover Card */}
              {selectedItemDetail && (() => {
                const item = allFinalItems.find(i => i.product.id === selectedItemDetail);
                if (!item) return null;
                return (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mt-2 animate-in fade-in">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{item.product.name}</span>
                      <span className="tabular-nums">{formatPaise(item.totalPaise)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>Brand: <strong className="text-slate-700">{item.product.brand}</strong></span>
                      <span>Package: <strong className="text-slate-700">{item.product.packageSize}</strong></span>
                      <span>Store: <strong className="capitalize text-slate-700">{item.storeName}</strong></span>
                    </div>
                    {item.isSubstitution && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1">
                        Substituted for preferred brand to prevent stockout.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Alternate Options Selector (Max 3, no letters A/B/C/D) */}
            {filteredStrategies.length > 1 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                  Other Order Options:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredStrategies.map(strat => {
                    const isSelected = strat.type === currentStrategy?.type;
                    return (
                      <button
                        key={strat.type}
                        onClick={() => setSelectedStrategyType(strat.type)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/30 ring-1 ring-brand-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                          <span className={isSelected ? 'text-brand-700' : 'text-slate-600'}>
                            {strat.friendlyName}
                          </span>
                          <span className="text-slate-900 tabular-nums">
                            {formatPaise(strat.grandTotalPaise)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                          {strat.friendlyDescription}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Autonomous order prepared • 1-Click PayPal simulated checkout
              </span>

              <Button
                variant="primary"
                size="md"
                disabled={allFinalItems.length === 0}
                onClick={() => {
                  if (needsApproval) {
                    onNavigateToTab('approvals');
                  } else if (checkoutStrategy) {
                    openCheckoutModal(checkoutStrategy);
                  }
                }}
                icon={<ShoppingBag className="w-4 h-4" />}
              >
                {hasPendingSwaps ? (
                  'Review Swaps in Approvals'
                  ) : !isUpcomingOrderSaved ? (
                  'Review & Save Order'
                ) : (
                  <span>Confirm and Pay for Order (<span className="tabular-nums">{formatPaise(upcomingOrder.totalPaise || grandTotalPaise)}</span>)</span>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Pantry Health & Deferred Items */}
        <div className="space-y-4">
          {/* Pantry Health Card */}
          <Card variant="default" className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm font-heading flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Pantry Health
                </h4>
                <span className="text-[11px] text-slate-500">{pantryItems.length} household essentials tracked</span>
              </div>
              <button
                onClick={() => onNavigateToTab('pantry')}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
              >
                Manage
              </button>
            </div>

            {/* Health Meter Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  style={{ width: `${wellStockedPct}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`${wellStockedCount} Well Stocked`}
                />
                <div
                  style={{ width: `${runningLowPct}%` }}
                  className="bg-amber-400 transition-all duration-500"
                  title={`${runningLowCount} Running Low`}
                />
                <div
                  style={{ width: `${ranOutPct}%` }}
                  className="bg-rose-500 transition-all duration-500"
                  title={`${ranOutCount} Ran Out`}
                />
              </div>

              {/* Status Breakdown Chips */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <span className="text-sm font-extrabold text-emerald-800 block tabular-nums">{wellStockedCount}</span>
                  <span className="text-[10px] text-emerald-700 font-medium">Safe</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <span className="text-sm font-extrabold text-amber-800 block tabular-nums">{runningLowCount}</span>
                  <span className="text-[10px] text-amber-700 font-medium">Low</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                  <span className="text-sm font-extrabold text-rose-800 block tabular-nums">{ranOutCount}</span>
                  <span className="text-[10px] text-rose-700 font-medium">Out</span>
                </div>
              </div>
            </div>

            {/* Deferred Items Callout */}
            {deferredRecs.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Deferred to Next Week:
                </span>
                <p className="text-[11px] text-slate-500">
                  {deferredRecs.length} item{deferredRecs.length === 1 ? '' : 's'} have enough stock to last past this cycle:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {deferredRecs.map(r => (
                    <span
                      key={r.itemId}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium"
                    >
                      {r.itemName} (~{r.daysRemaining}d left)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Quick Help Tip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>Smart Order Consolidation</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              ShopPilot balances store delivery fees and individual SKU prices so you pay the absolute minimum for your entire basket.
            </p>
          </div>
        </div>
      </div>

      {/* 3. "Why this?" Collapsible Section */}
      <Card variant="default" className="border-slate-200">
        <button
          onClick={() => setIsWhyThisOpen(!isWhyThisOpen)}
          className="w-full flex items-center justify-between text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm font-heading">Why this order?</h4>
              <p className="text-[11px] text-slate-500">
                View the optimizer logic, fee comparison, and store price matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
            <span>{isWhyThisOpen ? 'Hide machinery' : 'Explore details'}</span>
            {isWhyThisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isWhyThisOpen && (
          <div className="pt-5 mt-4 border-t border-slate-100 space-y-6 animate-in fade-in duration-200">
            {/* Optimizer Reasoning */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                Decision Breakdown
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {currentStrategy?.recommendationReason ||
                  'ShopPilot evaluated local quick-commerce availability across Blinkit, Zepto, and Instamart to minimize delivery fees and prevent pantry stockouts.'}
              </p>
            </div>

            {/* Store Price Matrix */}
            <div className="space-y-2">
              <h5 className="font-bold text-slate-900 text-xs">Live Cross-Store Catalog & Fees</h5>
              <StoreComparison />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
