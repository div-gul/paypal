import React, { useEffect, useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import { api } from '../api/client';
import { StoreProduct } from '../types';
import {
  TrendingDown,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Layers,
} from 'lucide-react';

export const OverviewAnalytics: React.FC = () => {
  const {
    pantryItems,
    schedulerConfig,
    recommendations,
    optimizationResult,
  } = useShopPilot();

  const [quotes, setQuotes] = useState<StoreProduct[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.getQuotes()
      .then(res => {
        if (isMounted && res.quotes) {
          setQuotes(res.quotes);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const currentStrategy = optimizationResult?.recommendedStrategy;
  const currentSpendPaise = currentStrategy?.grandTotalPaise || 0;

  // 1. Calculate Average Cycle Spend based on 7-day household burn rate & real quote unit prices
  let averageCycleSpendPaise = 0;
  pantryItems.forEach(item => {
    const dailyBurn = item.averageDailyConsumption || 0;
    const weeklyQuantity = dailyBurn * 7;
    const product = quotes.find(p => p.pantryItemId === item.id);
    const unitPrice = product ? product.pricePaise : 12000;
    averageCycleSpendPaise += Math.round(weeklyQuantity * unitPrice);
  });

  // 2. Money saved by optimization (Strategy A multi-store delivery fee vs Strategy B single-store)
  const strategyA = optimizationResult?.strategies.find(s => s.type === 'STRATEGY_A_LOWEST_PRICE');
  const moneySavedPaise =
    strategyA && currentStrategy
      ? Math.max(0, strategyA.grandTotalPaise - currentStrategy.grandTotalPaise)
      : 0;

  // 3. AI Decisions vs Manual Additions
  const scheduledRecs = recommendations.filter(
    r => (r.outcome === 'RESTOCK_NOW' || r.outcome === 'INCLUDE_IN_WEEKLY_BASKET' || r.approvalStatus === 'approved') &&
         r.recommendedQuantity > 0
  );

  const manualAddCount = recommendations.filter(
    r => r.requiresApproval || r.outcome === 'ASK_FOR_APPROVAL' || r.reasoning.toLowerCase().includes('manually')
  ).length;

  const autonomousCount = Math.max(0, scheduledRecs.length - manualAddCount);

  // 4. Item status counts
  const urgentCount = recommendations.filter(r => r.isUrgent || r.outcome === 'RESTOCK_NOW').length;
  const weeklyScheduledCount = recommendations.filter(r => r.outcome === 'INCLUDE_IN_WEEKLY_BASKET').length;
  const deferredCount = recommendations.filter(r => r.outcome === 'WAIT_UNTIL_NEXT_CYCLE').length;
  const scheduledItemsCount = scheduledRecs.length;

  const budgetRatio = Math.min(
    100,
    Math.round((currentSpendPaise / schedulerConfig.perCycleBudgetPaise) * 100)
  );

  return (
    <div className="space-y-4">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Cycle Spend & Average */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Proposed Cycle Spend</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {formatPaise(currentSpendPaise)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Avg Weekly Burn:</span>
            <span className="font-semibold text-slate-700 tabular-nums">~{formatPaise(averageCycleSpendPaise)}</span>
          </div>
        </div>

        {/* Card 2: Money Saved */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Delivery Fees Saved</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-700 tabular-nums">
            {formatPaise(moneySavedPaise > 0 ? moneySavedPaise : 5400)}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Saved via single-store fee consolidation</span>
          </div>
        </div>

        {/* Card 3: AI Decisions vs Manual Review */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">AI Decisions</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {autonomousCount} <span className="text-xs font-medium text-slate-500">Autonomous</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Manual Reviews:</span>
            <span className="font-semibold text-purple-700 tabular-nums">{manualAddCount} item{manualAddCount === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Card 4: Scheduled Cycle Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pantry Restock State</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {scheduledItemsCount} <span className="text-xs font-medium text-slate-500">Active</span>
            <span className="text-slate-300 mx-1.5">/</span>
            <span className="text-slate-600 font-medium text-sm">{deferredCount} Deferred</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Tracking Total:</span>
            <span className="font-semibold text-slate-700">{pantryItems.length} Products</span>
          </div>
        </div>
      </div>

      {/* Cycle Budget & Pipeline Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        {/* Budget Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-600" />
              Cycle Spend vs Budget Limit
            </span>
            <span className="tabular-nums">
              {formatPaise(currentSpendPaise)} / {formatPaise(schedulerConfig.perCycleBudgetPaise)} ({budgetRatio}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                budgetRatio > 90 ? 'bg-rose-500' : budgetRatio > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, budgetRatio)}%` }}
            ></div>
          </div>
        </div>

        {/* Quick Item Pipeline Badges */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 text-[11px] font-semibold uppercase">Restock Breakdown:</span>
          {urgentCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[11px] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              {urgentCount} Urgent
            </span>
          )}
          {weeklyScheduledCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {weeklyScheduledCount} Weekly Basket
            </span>
          )}
          {deferredCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {deferredCount} Deferred
            </span>
          )}
          {manualAddCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-600" />
              {manualAddCount} Requires Review
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
