import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import { filterAndRankStrategies } from '../lib/labels';
import { Card, Button, ProductImage } from './ui';
import { StoreComparison } from './StoreComparison';
import {
  Sparkles,
  ShoppingBag,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Calendar,
  Layers,
  Wallet,
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
    prepareUpcomingOrderCheckout,
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
  const hasPendingSwaps = !upcomingOrder.paidAt && pendingSwaps.length > 0;
  const needsApproval = hasPendingSwaps || !isUpcomingOrderSaved;
  const hasUnpaidAdditions = upcomingOrder.items.some(item =>
    item.quantity > (upcomingOrder.paidQuantities?.[item.pantryItemId] || 0)
  );
  const unpaidSubtotalPaise = upcomingOrder.items.reduce((sum, item) =>
    sum + Math.max(0, item.quantity - (upcomingOrder.paidQuantities?.[item.pantryItemId] || 0)) * item.unitPricePaise,
  0);
  const unpaidTotalPaise = unpaidSubtotalPaise + (upcomingOrder.paidAt && unpaidSubtotalPaise > 0 && unpaidSubtotalPaise < 39900 ? 2000 : 0);

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

  // The displayed and payable amount must come from the same editable order.
  // Do not fall back to an optimizer total when this cart is empty.
  const grandTotalPaise = allFinalItems.length > 0 ? upcomingOrder.totalPaise : 0;
  const isBudgetSafe = grandTotalPaise <= schedulerConfig.perCycleBudgetPaise;
  const budgetUsagePercent = Math.min(
    100,
    Math.round((grandTotalPaise / Math.max(1, schedulerConfig.perCycleBudgetPaise)) * 100)
  );

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
    if (upcomingOrder.paidAt) {
      return hasUnpaidAdditions
        ? `Your upcoming order for ${upcomingOrder.scheduledDate} is paid. Added items are ready for an extra payment.`
        : `Upcoming order for ${upcomingOrder.scheduledDate} is paid (${formatPaise(upcomingOrder.totalPaise)}). You can add more items if needed.`;
    }
    if (activeRun?.status === 'paid') {
      return 'Your latest restock payment is complete.';
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
        className={`rounded-xl p-4 sm:p-5 border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-soft ${
          needsApproval
            ? 'bg-accent-tint border-accent/25 text-accent-dark'
            : activeRun?.status === 'paid' || isUpcomingOrderSaved
            ? 'bg-good/15 border-good/30 text-good'
            : 'bg-surface border-secondary-tint text-ink'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              needsApproval
                ? 'bg-accent/15 text-accent-dark'
                : activeRun?.status === 'paid' || isUpcomingOrderSaved
                ? 'bg-good/20 text-good'
                : 'bg-brand-tint text-brand'
            }`}
          >
            {needsApproval ? (
              <AlertTriangle className="w-5 h-5 text-accent-dark" />
            ) : activeRun?.status === 'paid' || isUpcomingOrderSaved ? (
              <CheckCircle2 className="w-5 h-5 text-good" />
            ) : (
              <Sparkles className="w-5 h-5 text-brand" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
              Household Status
            </span>
            <p className="text-sm font-semibold leading-snug">
              {getStatusSentence()}
            </p>
          </div>
        </div>

        {/* Quiet secondary action link */}
        {needsApproval && (
          <button
            onClick={() => onNavigateToTab('approvals')}
            className="text-xs font-semibold text-accent-dark hover:underline flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-accent/10 transition shrink-0"
          >
            <span>{hasPendingSwaps ? `Review Swaps (${pendingSwaps.length})` : 'Review in Approvals'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Main Two-Column Grid: Recommended Order Hero Card + Pantry Health & Budget Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Recommended Order Hero Card */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="elevated" className="p-6 space-y-5 border-secondary-tint">
            {/* Order Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-secondary-tint pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-brand-tint text-brand tracking-wider">
                    Recommended Order
                  </span>
                  <span className="text-xs text-ink-muted font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-secondary" /> Scheduled for {nextRunDayName}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-ink mt-1">
                  {storesCount === 1 ? `${primaryStoreName} Consolidated Order` : `Multi-Store Split (${storesCount} Stores)`}
                </h3>
              </div>

              {/* Price & Delivery pill */}
              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-semibold text-ink-muted block">Total Payable</span>
                <span className="text-2xl font-bold text-ink tabular-nums">
                  {formatPaise(grandTotalPaise)}
                </span>
              </div>
            </div>

            {/* Quick Order Stats */}
            <div className="grid grid-cols-3 gap-3 py-1 text-xs">
              <div className="bg-paper rounded-xl p-3 border border-secondary-tint space-y-0.5">
                <span className="text-[10px] text-ink-muted font-medium uppercase block">Items to Buy</span>
                <span className="text-base font-bold text-ink tabular-nums">
                  {allFinalItems.length} <span className="text-xs font-normal text-ink-muted">products</span>
                </span>
              </div>

              <div className="bg-paper rounded-xl p-3 border border-secondary-tint space-y-0.5">
                <span className="text-[10px] text-ink-muted font-medium uppercase block">Delivery Time</span>
                <span className="text-base font-bold text-ink flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-secondary" /> ~10 min
                </span>
              </div>

              <div className="bg-paper rounded-xl p-3 border border-secondary-tint space-y-0.5">
                <span className="text-[10px] text-ink-muted font-medium uppercase block">Budget Limit</span>
                <span className="text-base font-bold text-good tabular-nums">
                  {formatPaise(schedulerConfig.perCycleBudgetPaise)}
                </span>
              </div>
            </div>

            {/* Restock Item Chips */}
            <div className="space-y-2 pt-2 border-t border-secondary-tint">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span className="font-semibold text-ink">Included In This Order:</span>
                <span className="text-[11px] text-ink-muted">Click any item for details</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {allFinalItems.map(item => {
                  const isSelected = selectedItemDetail === item.product.id;
                  return (
                    <button
                      key={item.product.id}
                      onClick={() => setSelectedItemDetail(isSelected ? null : item.product.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-2 ${
                        isSelected
                          ? 'bg-brand-tint border-brand text-brand ring-1 ring-brand'
                          : 'bg-surface hover:bg-paper border-secondary-tint text-ink'
                      }`}
                    >
                      <ProductImage
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        size="sm"
                        className="w-5 h-5 rounded-md"
                      />
                      <span>{item.quantity}x {item.product.name}</span>
                      <span className="text-[10px] text-ink-muted tabular-nums">({formatPaise(item.totalPaise)})</span>
                      {item.isSubstitution && (
                        <span className="w-2 h-2 rounded-full bg-secondary" title="Substituted brand" />
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
                  <div className="p-3.5 rounded-xl bg-paper border border-secondary-tint text-xs space-y-2 mt-2">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between font-bold text-ink">
                          <span className="truncate">{item.product.name}</span>
                          <span className="tabular-nums ml-2 shrink-0">{formatPaise(item.totalPaise)}</span>
                        </div>
                        <div className="text-[11px] text-ink-muted flex items-center gap-3 mt-0.5">
                          <span>Brand: <strong className="text-ink">{item.product.brand}</strong></span>
                          <span>Package: <strong className="text-ink">{item.product.packageSize}</strong></span>
                          <span>Store: <strong className="capitalize text-ink">{item.storeName}</strong></span>
                        </div>
                      </div>
                    </div>
                    {item.isSubstitution && (
                      <p className="text-[11px] text-secondary bg-secondary-tint p-2 rounded-lg border border-secondary/20 mt-1">
                        Substituted for preferred brand to prevent stockout.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Alternate Options Selector */}
            {filteredStrategies.length > 1 && (
              <div className="space-y-2 pt-2 border-t border-secondary-tint">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wide block">
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
                            ? 'border-brand bg-brand-tint/30 ring-1 ring-brand'
                            : 'border-secondary-tint hover:border-secondary bg-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                          <span className={isSelected ? 'text-brand' : 'text-ink'}>
                            {strat.friendlyName}
                          </span>
                          <span className="text-ink tabular-nums">
                            {formatPaise(strat.grandTotalPaise)}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-muted line-clamp-1 leading-tight">
                          {strat.friendlyDescription}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order Action Footer — Single Primary Orange Button */}
            <div className="pt-4 border-t border-secondary-tint flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">
                Autonomous order prepared • 1-Click PayPal simulated checkout
              </span>

              <Button
                variant="primary"
                size="md"
                disabled={allFinalItems.length === 0 || (Boolean(upcomingOrder.paidAt) && !hasUnpaidAdditions)}
                onClick={() => {
                  if (needsApproval) {
                    onNavigateToTab('approvals');
                  } else if (!upcomingOrder.paidAt || hasUnpaidAdditions) {
                    void prepareUpcomingOrderCheckout();
                  }
                }}
                icon={needsApproval ? <ArrowRight className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              >
                {upcomingOrder.paidAt && !hasUnpaidAdditions ? (
                  `Paid for ${upcomingOrder.scheduledDate}`
                ) : hasPendingSwaps ? (
                  `Review Swaps in Approvals (${pendingSwaps.length})`
                ) : !isUpcomingOrderSaved ? (
                  'Review and Approve Order'
                ) : (
                  <span>{upcomingOrder.paidAt ? 'Pay Added Items' : 'Approve and Pay'} (<span className="tabular-nums">{formatPaise(upcomingOrder.paidAt ? unpaidTotalPaise : (upcomingOrder.totalPaise || grandTotalPaise))}</span>)</span>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Pantry Health & Budget Bar */}
        <div className="space-y-4">
          {/* Pantry Health Card */}
          <Card variant="default" className="space-y-4 border-secondary-tint">
            <div className="flex items-center justify-between border-b border-secondary-tint pb-3">
              <div>
                <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-brand" />
                  Pantry Health
                </h4>
                <span className="text-[11px] text-ink-muted">{pantryItems.length} household essentials tracked</span>
              </div>
              <button
                onClick={() => onNavigateToTab('pantry')}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Manage
              </button>
            </div>

            {/* Health Meter Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-paper border border-secondary-tint overflow-hidden flex">
                <div
                  style={{ width: `${wellStockedPct}%` }}
                  className="bg-good transition-all duration-500"
                  title={`${wellStockedCount} Well Stocked`}
                />
                <div
                  style={{ width: `${runningLowPct}%` }}
                  className="bg-accent transition-all duration-500"
                  title={`${runningLowCount} Running Low`}
                />
                <div
                  style={{ width: `${ranOutPct}%` }}
                  className="bg-danger transition-all duration-500"
                  title={`${ranOutCount} Ran Out`}
                />
              </div>

              {/* Status Breakdown Chips with Icons & Text Labels */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-2 rounded-xl bg-good/15 border border-good/30 text-good">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <CheckCircle2 className="w-3 h-3 text-good" />
                    <span className="text-sm font-bold tabular-nums">{wellStockedCount}</span>
                  </div>
                  <span className="text-[10px] font-semibold">Safe</span>
                </div>
                <div className="p-2 rounded-xl bg-accent-tint border border-accent/25 text-accent-dark">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Clock className="w-3 h-3 text-accent-dark" />
                    <span className="text-sm font-bold tabular-nums">{runningLowCount}</span>
                  </div>
                  <span className="text-[10px] font-semibold">Low</span>
                </div>
                <div className="p-2 rounded-xl bg-danger/10 border border-danger/25 text-danger">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <AlertCircle className="w-3 h-3 text-danger" />
                    <span className="text-sm font-bold tabular-nums">{ranOutCount}</span>
                  </div>
                  <span className="text-[10px] font-semibold">Out</span>
                </div>
              </div>
            </div>

            {/* Deferred Items Callout */}
            {deferredRecs.length > 0 && (
              <div className="pt-3 border-t border-secondary-tint space-y-1.5 text-xs text-ink-muted">
                <span className="text-[11px] font-bold text-ink block">
                  Deferred to Next Week:
                </span>
                <p className="text-[11px] text-ink-muted">
                  {deferredRecs.length} item{deferredRecs.length === 1 ? '' : 's'} have enough stock to last past this cycle:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {deferredRecs.map(r => (
                    <span
                      key={r.itemId}
                      className="px-2 py-0.5 rounded-md bg-secondary-tint text-secondary text-[10px] font-medium"
                    >
                      {r.itemName} (~{r.daysRemaining}d left)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Budget Bar Card */}
          <Card variant="default" className="space-y-3 border-secondary-tint">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-secondary" />
                Cycle Budget
              </h4>
              <span className="text-xs font-semibold tabular-nums text-ink">
                {formatPaise(grandTotalPaise)} / {formatPaise(schedulerConfig.perCycleBudgetPaise)}
              </span>
            </div>

            {/* Budget Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-paper border border-secondary-tint overflow-hidden">
                <div
                  style={{ width: `${budgetUsagePercent}%` }}
                  className={`h-full transition-all duration-500 ${
                    isBudgetSafe ? 'bg-good' : 'bg-danger'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-muted">
                  {budgetUsagePercent}% allocated
                </span>
                <span className={`font-semibold flex items-center gap-1 ${isBudgetSafe ? 'text-good' : 'text-danger'}`}>
                  {isBudgetSafe ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-good" />
                      <span>{formatPaise(schedulerConfig.perCycleBudgetPaise - grandTotalPaise)} under cap</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-danger" />
                      <span>Exceeds cap by {formatPaise(grandTotalPaise - schedulerConfig.perCycleBudgetPaise)}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. "Why this?" Collapsible Section (Secondary / Slate AI styling) */}
      <Card variant="default" className="border-secondary-tint">
        <button
          onClick={() => setIsWhyThisOpen(!isWhyThisOpen)}
          className="w-full flex items-center justify-between text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-secondary-tint text-secondary flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-ink text-sm">Why this order?</h4>
              <p className="text-[11px] text-ink-muted">
                View the optimizer logic, fee comparison, and store price matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <span>{isWhyThisOpen ? 'Hide reasoning' : 'Explore reasoning'}</span>
            {isWhyThisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isWhyThisOpen && (
          <div className="pt-5 mt-4 border-t border-secondary-tint space-y-6">
            {/* Optimizer Reasoning Card */}
            <div className="bg-secondary-tint/40 rounded-xl p-4 border border-secondary-tint space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-secondary" />
                <span>Decision Breakdown</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {currentStrategy?.recommendationReason ||
                  'ShopPilot evaluated local quick-commerce availability across Blinkit, Zepto, and Instamart to minimize delivery fees and prevent pantry stockouts.'}
              </p>
            </div>

            {/* Store Price Matrix */}
            <div className="space-y-2">
              <h5 className="font-bold text-ink text-xs">Live Cross-Store Catalog & Fees</h5>
              <StoreComparison />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
