import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { RestockDecisionOutcome } from '../types';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Info,
  Plus,
  Truck,
  PackagePlus,
  ShieldCheck,
} from 'lucide-react';
import { formatPaise } from '../services/currency';
import { getDaysUntilNextShoppingRun } from '../services/restockScheduler';

export const ShoppingAnalysis: React.FC = () => {
  const {
    recommendations,
    approveRecommendation,
    rejectRecommendation,
    includeInWeeklyBasket,
    includeInUrgentBasket,
    removeFromBasket,
    approveAllUrgentItems,
    isAnalyzing,
    simulationState,
    schedulerConfig,
  } = useShopPilot();

  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'weekly' | 'deferred' | 'approvals'>('all');

  const daysUntilNextRun = getDaysUntilNextShoppingRun(
    simulationState.simulatedDate,
    schedulerConfig.nextShoppingDate
  );

  const urgentCount = recommendations.filter(r => r.isUrgent || r.outcome === 'RESTOCK_NOW').length;
  const weeklyCount = recommendations.filter(r => r.outcome === 'INCLUDE_IN_WEEKLY_BASKET').length;
  const deferredCount = recommendations.filter(r => r.outcome === 'WAIT_UNTIL_NEXT_CYCLE').length;
  const approvalCount = recommendations.filter(r => r.outcome === 'ASK_FOR_APPROVAL' || (r.requiresApproval && r.approvalStatus === 'pending')).length;

  const filteredRecs = recommendations.filter(r => {
    if (activeTab === 'urgent') return r.outcome === 'RESTOCK_NOW' || r.isUrgent;
    if (activeTab === 'weekly') return r.outcome === 'INCLUDE_IN_WEEKLY_BASKET';
    if (activeTab === 'deferred') return r.outcome === 'WAIT_UNTIL_NEXT_CYCLE';
    if (activeTab === 'approvals') return r.outcome === 'ASK_FOR_APPROVAL' || (r.requiresApproval && r.approvalStatus === 'pending');
    return true;
  });

  const getOutcomeBadge = (outcome: RestockDecisionOutcome, requiresApproval: boolean, isApproved: boolean) => {
    if (requiresApproval && !isApproved) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
          <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
          APPROVAL PENDING
        </span>
      );
    }

    switch (outcome) {
      case 'RESTOCK_NOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            RESTOCK NOW (URGENT)
          </span>
        );
      case 'INCLUDE_IN_WEEKLY_BASKET':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            IN WEEKLY BASKET
          </span>
        );
      case 'WAIT_UNTIL_NEXT_CYCLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            DEFERRED (SAFE)
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <Ban className="w-3.5 h-3.5 text-rose-600" />
            PURCHASE BLOCKED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Autonomous Restock Decisions & AI Policy Evaluation
            </h2>
            {isAnalyzing && (
              <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Dynamically evaluated from current pantry depletion rates, scheduled shopping date, and store fee trade-offs.
          </p>
        </div>

        {/* Global Quick Action: Approve All Pending Urgents */}
        {approvalCount > 0 && (
          <button
            onClick={approveAllUrgentItems}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-purple-200" />
            <span>Approve & Add All Urgents ({approvalCount})</span>
          </button>
        )}
      </div>

      {/* Explanatory Banner: Why are urgent items handled with caution? */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>How Urgent Items & Weekly Restocking Work</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          • <strong>Why an urgent item isn't automatically mixed into the weekly basket:</strong> An urgent item will run out <em>before</em> your next weekly shopping run (in <strong>{daysUntilNextRun} days</strong>).
          <br />
          • <strong>Your Choices for Each Urgent Product:</strong>
          <br />
          &nbsp;&nbsp;1. <strong>🚀 Restock Now</strong>: Creates an immediate off-cycle order so you don't run out. (Subject to your emergency restock policy: requires approval to prevent unexpected standalone delivery fees).
          <br />
          &nbsp;&nbsp;2. <strong>📦 Bundle into Weekly Basket</strong>: If you don't mind waiting until your scheduled cycle date, you can bundle it into the weekly run to save delivery fees!
        </p>
      </div>

      {/* Tab Filters */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
            activeTab === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Items ({recommendations.length})
        </button>
        <button
          onClick={() => setActiveTab('urgent')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'urgent' ? 'bg-white text-red-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Urgents</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-800 font-bold">
            {urgentCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'weekly' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Weekly Basket</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
            {weeklyCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('deferred')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'deferred' ? 'bg-white text-slate-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Deferred</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 font-bold">
            {deferredCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'approvals' ? 'bg-purple-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Requires Approval</span>
          {approvalCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-purple-700 font-bold">
              {approvalCount}
            </span>
          )}
        </button>
      </div>

      {/* Decision Cards List */}
      <div className="space-y-3">
        {filteredRecs.map(rec => {
          const isApproved = rec.approvalStatus === 'approved';
          const isPending = rec.requiresApproval && rec.approvalStatus === 'pending';
          const isInActiveBasket =
            (rec.outcome === 'RESTOCK_NOW' || rec.outcome === 'INCLUDE_IN_WEEKLY_BASKET' || isApproved) &&
            rec.recommendedQuantity > 0;

          return (
            <div
              key={rec.itemId}
              className={`rounded-xl border p-4 transition ${
                isPending
                  ? 'bg-purple-50/40 border-purple-300 shadow-xs ring-1 ring-purple-200'
                  : rec.outcome === 'RESTOCK_NOW'
                  ? 'bg-red-50/20 border-red-200'
                  : rec.outcome === 'INCLUDE_IN_WEEKLY_BASKET'
                  ? 'bg-emerald-50/20 border-emerald-200'
                  : rec.outcome === 'BLOCKED'
                  ? 'bg-rose-50/40 border-rose-300'
                  : 'bg-slate-50/50 border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Product Info & Decision Reasoning */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{rec.itemName}</h3>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-600">
                      Current: {rec.currentQuantity} {rec.unit}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-600">
                      Remaining:{' '}
                      <strong className={rec.daysRemaining !== null && rec.daysRemaining < 3 ? 'text-red-600' : 'text-slate-700'}>
                        {rec.daysRemaining !== null ? `${rec.daysRemaining} days` : 'safe'}
                      </strong>
                    </span>
                    {getOutcomeBadge(rec.outcome, rec.requiresApproval, isApproved)}
                  </div>

                  {/* Human-readable dynamic explanation */}
                  <div className="text-xs text-slate-700 bg-white/80 border border-slate-200/80 rounded-lg p-2.5 flex items-start gap-2 shadow-2xs">
                    <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Agent Rationale: </strong>
                      {rec.reasoning}
                    </p>
                  </div>

                  {/* Policy Approval Prompt if pending */}
                  {isPending && rec.approvalReason && (
                    <div className="bg-purple-100/90 border border-purple-300 rounded-lg p-3 text-xs text-purple-950 space-y-2">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-purple-700 shrink-0" />
                        <span>
                          <strong>User Policy Gate:</strong> {rec.approvalReason}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-200">
                        <button
                          onClick={() => approveRecommendation(rec.itemId)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Approve & Add to Basket Now
                        </button>
                        <button
                          onClick={() => includeInWeeklyBasket(rec.itemId)}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <PackagePlus className="w-3.5 h-3.5" /> Bundle into Weekly Basket Instead
                        </button>
                        <button
                          onClick={() => rejectRecommendation(rec.itemId)}
                          className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-rose-700 border border-rose-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> Reject / Defer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Interactive Basket Management Buttons */}
                  {!isPending && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {rec.outcome === 'RESTOCK_NOW' && (
                        <>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Added to Urgent Order List
                          </span>
                          <button
                            onClick={() => includeInWeeklyBasket(rec.itemId)}
                            className="text-xs px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <PackagePlus className="w-3.5 h-3.5 text-indigo-600" />
                            Move to Weekly Basket (Save Fees)
                          </button>
                          <button
                            onClick={() => removeFromBasket(rec.itemId)}
                            className="text-xs px-2.5 py-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            Remove
                          </button>
                        </>
                      )}

                      {rec.outcome === 'INCLUDE_IN_WEEKLY_BASKET' && (
                        <>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            In Weekly Restock Basket
                          </span>
                          <button
                            onClick={() => includeInUrgentBasket(rec.itemId)}
                            className="text-xs px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 text-red-600" />
                            Order As Immediate Urgent
                          </button>
                          <button
                            onClick={() => removeFromBasket(rec.itemId)}
                            className="text-xs px-2.5 py-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            Remove
                          </button>
                        </>
                      )}

                      {rec.outcome === 'WAIT_UNTIL_NEXT_CYCLE' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => includeInWeeklyBasket(rec.itemId)}
                            className="text-xs px-3 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-brand-600" />
                            Add to Weekly Basket Anyway
                          </button>
                          <button
                            onClick={() => includeInUrgentBasket(rec.itemId)}
                            className="text-xs px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 text-red-600" />
                            Order Urgently Today
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Proposed Purchase Details */}
                {rec.selectedProduct && (
                  <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs min-w-[220px] shrink-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Matched Store SKU
                      </span>
                      {isInActiveBasket ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          In Basket
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          Not in Basket
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-900 leading-snug">
                      {rec.selectedProduct.name}
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center justify-between">
                      <span>
                        Qty: <strong>{rec.recommendedQuantity > 0 ? rec.recommendedQuantity : 1}x</strong> ({rec.targetPackageSize})
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatPaise(rec.selectedProduct.pricePaise * (rec.recommendedQuantity > 0 ? rec.recommendedQuantity : 1))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Store: <strong className="capitalize">{rec.selectedStore}</strong></span>
                      <span className={rec.selectedProduct.isExactBrandMatch ? 'text-emerald-600 font-medium' : 'text-amber-600 font-semibold'}>
                        {rec.selectedProduct.isExactBrandMatch ? 'Preferred Brand' : 'Brand Substitute'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
