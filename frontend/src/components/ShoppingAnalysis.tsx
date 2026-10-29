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
  Plus,
  Truck,
  PackagePlus,
  ShieldCheck,
  ShieldAlert,
  Radio,
  TrendingUp,
  RefreshCw,
  Bot,
} from 'lucide-react';
import { formatPaise } from '../services/currency';
import { api, AiSubstituteResult } from '../api/client';
import { MOCK_STORE_CATALOG } from '../adapters/mockStoreData';

export const ShoppingAnalysis: React.FC = () => {
  const {
    recommendations,
    pantryItems,
    includeInWeeklyBasket,
    includeInUrgentBasket,
    removeFromBasket,
    isAnalyzing,
    activeRun,
    approveRun,
    rejectRun,
    isLoading,
  } = useShopPilot();

  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'weekly' | 'deferred' | 'approvals'>('all');

  // AI Substitution state
  const [aiLoadingItemId, setAiLoadingItemId] = useState<string | null>(null);
  const [aiSubstitutes, setAiSubstitutes] = useState<Record<string, AiSubstituteResult>>({});
  const [aiSubError, setAiSubError] = useState<Record<string, string>>({});

  const urgentCount = recommendations.filter(r => r.isUrgent || r.outcome === 'RESTOCK_NOW').length;
  const weeklyCount = recommendations.filter(r => r.outcome === 'INCLUDE_IN_WEEKLY_BASKET').length;
  const deferredCount = recommendations.filter(r => r.outcome === 'WAIT_UNTIL_NEXT_CYCLE').length;
  const approvalCount = recommendations.filter(
    r => r.outcome === 'ASK_FOR_APPROVAL' || (r.requiresApproval && r.approvalStatus === 'pending')
  ).length;

  const isRunPendingApproval = activeRun?.status === 'needs_approval';

  const filteredRecs = recommendations.filter(r => {
    if (activeTab === 'urgent') return r.outcome === 'RESTOCK_NOW' || r.isUrgent;
    if (activeTab === 'weekly') return r.outcome === 'INCLUDE_IN_WEEKLY_BASKET';
    if (activeTab === 'deferred') return r.outcome === 'WAIT_UNTIL_NEXT_CYCLE';
    if (activeTab === 'approvals')
      return r.outcome === 'ASK_FOR_APPROVAL' || (r.requiresApproval && r.approvalStatus === 'pending');
    return true;
  });

  const handleRequestAiSubstitute = async (itemId: string, itemName: string) => {
    const pantryItem = pantryItems.find(p => p.id === itemId);
    const candidates = MOCK_STORE_CATALOG.filter(c => c.pantryItemId === itemId);

    if (candidates.length === 0) {
      setAiSubError(prev => ({ ...prev, [itemId]: 'No store candidates available for this item.' }));
      return;
    }

    setAiLoadingItemId(itemId);
    setAiSubError(prev => ({ ...prev, [itemId]: '' }));

    try {
      const res = await api.substituteAI({
        pantryItemId: itemId,
        itemName,
        preferredBrand: pantryItem?.preferredBrand || '',
        candidates,
        reason: 'User requested intelligent candidate substitution',
      });
      setAiSubstitutes(prev => ({ ...prev, [itemId]: res.substitute }));
    } catch (err: any) {
      setAiSubError(prev => ({ ...prev, [itemId]: err.message || 'AI substitution lookup failed' }));
    } finally {
      setAiLoadingItemId(null);
    }
  };

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
              Restock Decisions
            </h2>
            {isAnalyzing && (
              <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            )}
          </div>
        </div>

        {/* Run-Level Status Badge */}
        {activeRun && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Run Status:</span>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                activeRun.status === 'needs_approval'
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : activeRun.status === 'approved' || activeRun.status === 'ready'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {activeRun.status.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Decision 3: Run-Level Approval Banner */}
      {isRunPendingApproval && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-purple-950 text-xs">
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              <span>Restock Run Requires User Approval</span>
            </div>
            <p className="text-[11px] text-purple-800 leading-snug">
              Autonomous policy detected off-cycle urgent items, brand substitutions, or budget thresholds requiring confirmation.
              Approvals apply to the entire restock run.
            </p>
            {activeRun?.decisionReasons && activeRun.decisionReasons.length > 0 && (
              <ul className="text-[10px] text-purple-900 list-disc list-inside pt-0.5 space-y-0.5">
                {activeRun.decisionReasons.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={approveRun}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve Restock Run</span>
            </button>
            <button
              onClick={rejectRun}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Reject Run
            </button>
          </div>
        </div>
      )}

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
        {filteredRecs.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
            No restock items in this category.
          </div>
        ) : (
          filteredRecs.map(rec => {
            const isApproved = rec.approvalStatus === 'approved';
            const isPending = rec.requiresApproval && rec.approvalStatus === 'pending';
            const isInActiveBasket =
              (rec.outcome === 'RESTOCK_NOW' || rec.outcome === 'INCLUDE_IN_WEEKLY_BASKET' || isApproved) &&
              rec.recommendedQuantity > 0;

            const isSub = Boolean(rec.isSubstitution || (rec.selectedProduct && !rec.selectedProduct.isExactBrandMatch));
            const isSpike = Boolean(rec.isPriceSpike || (rec.priceSpikePercent && rec.priceSpikePercent > 0));
            const isEmergency = Boolean(rec.isUrgent || rec.isEmergencyStockout);
            const isLive = rec.selectedProduct?.source === 'channel3';

            const aiSub = aiSubstitutes[rec.itemId];
            const aiErrorMsg = aiSubError[rec.itemId];
            const isAiLoading = aiLoadingItemId === rec.itemId;

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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Side: Item Info & Policy Flags */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{rec.itemName}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {rec.category}
                      </span>

                      {/* Decision 3: Per-Line Item Flags */}
                      {isEmergency && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          Emergency Stockout
                        </span>
                      )}
                      {isSub && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-amber-600" />
                          Substituted Brand
                        </span>
                      )}
                      {isSpike && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-orange-600" />
                          Price Spike {rec.priceSpikePercent ? `(+${rec.priceSpikePercent}%)` : ''}
                        </span>
                      )}
                    </div>

                    <p className="text-slate-600 text-xs leading-relaxed">{rec.reasoning}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="text-xs text-slate-600">
                        Current: <strong>{rec.currentQuantity}</strong>
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-600">
                        Remaining:{' '}
                        <strong
                          className={
                            rec.daysRemaining !== null && rec.daysRemaining < 3
                              ? 'text-red-600'
                              : 'text-slate-700'
                          }
                        >
                          {rec.daysRemaining !== null ? `${rec.daysRemaining} days` : 'safe'}
                        </strong>
                      </span>
                      {getOutcomeBadge(rec.outcome, rec.requiresApproval, isApproved)}
                    </div>

                    {/* Interactive Basket Management Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
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
                            Defer
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
                            Defer
                          </button>
                        </>
                      )}

                      {(rec.outcome === 'WAIT_UNTIL_NEXT_CYCLE' || rec.outcome === 'ASK_FOR_APPROVAL' || isPending) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => includeInWeeklyBasket(rec.itemId)}
                            className="text-xs px-3 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-brand-600" />
                            Include in Weekly Basket
                          </button>
                          <button
                            onClick={() => includeInUrgentBasket(rec.itemId)}
                            className="text-xs px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 text-red-600" />
                            Order Urgently Today
                          </button>
                          {isInActiveBasket && (
                            <button
                              onClick={() => removeFromBasket(rec.itemId)}
                              className="text-xs px-2.5 py-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              Defer
                            </button>
                          )}
                        </div>
                      )}

                      {/* AI Suggest Alternative Button */}
                      {isSub && (
                        <button
                          onClick={() => handleRequestAiSubstitute(rec.itemId, rec.itemName)}
                          disabled={isAiLoading}
                          className="text-xs px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {isAiLoading ? (
                            <>
                              <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                              <span>Consulting AI...</span>
                            </>
                          ) : (
                            <>
                              <Bot className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Suggest AI Alternative</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* AI Alternative Result Banner */}
                    {aiSub && (
                      <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-950 space-y-1 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-indigo-900">
                            <Bot className="w-3.5 h-3.5 text-indigo-600" />
                            AI Recommendation: {aiSub.productName} ({aiSub.brand})
                          </span>
                          <span className="font-mono font-bold text-indigo-900">
                            {formatPaise(aiSub.pricePaise)} • {Math.round(aiSub.confidence * 100)}% match
                          </span>
                        </div>
                        <p className="text-indigo-800 text-[11px] leading-relaxed">{aiSub.reasoning}</p>
                      </div>
                    )}

                    {aiErrorMsg && (
                      <div className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-1">
                        {aiErrorMsg}
                      </div>
                    )}
                  </div>

                  {/* Proposed Purchase Details & Quote Source Badge */}
                  {rec.selectedProduct && (
                    <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs min-w-[230px] shrink-0 space-y-1.5">
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
                          {formatPaise(
                            rec.selectedProduct.pricePaise *
                              (rec.recommendedQuantity > 0 ? rec.recommendedQuantity : 1)
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-1">
                        <span>
                          Store: <strong className="capitalize">{rec.selectedStore}</strong>
                        </span>

                        {/* Decision: Live price vs Simulated Quote source badge */}
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
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
