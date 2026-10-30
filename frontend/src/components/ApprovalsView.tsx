import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import { Card, Button, Badge, EmptyState } from './ui';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  Clock,
  Sparkles,
  Bot,
} from 'lucide-react';
import { getFriendlyStockUrgencyLabel, formatQuantityWithUnit } from '../lib/labels';
import { api, AiSubstituteResult } from '../api/client';
import { StoreProduct } from '@shared/types';

export const ApprovalsView: React.FC = () => {
  const {
    pantryItems,
    recommendations,
    activeRun,
    approveRun,
    approveRecommendation,
    rejectRecommendation,
    optimizationResult,
    selectedStrategyType,
    isLoading,
  } = useShopPilot();

  const [aiLoadingItemId, setAiLoadingItemId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ [itemId: string]: AiSubstituteResult }>({});
  const [aiErrors, setAiErrors] = useState<{ [itemId: string]: string }>({});

  const currentStrategy =
    optimizationResult?.strategies.find(s => s.type === selectedStrategyType) ||
    optimizationResult?.recommendedStrategy;

  // Filter recommendations that strictly require approval and are pending
  const pendingApprovals =
    activeRun?.status === 'approved'
      ? []
      : recommendations.filter(
          rec =>
            rec.approvalStatus !== 'approved' &&
            rec.approvalStatus !== 'rejected' &&
            (rec.requiresApproval || rec.isSubstitution)
        );

  const handleSuggestAiAlternate = async (rec: typeof pendingApprovals[0]) => {
    setAiLoadingItemId(rec.itemId);
    setAiErrors(prev => ({ ...prev, [rec.itemId]: '' }));

    try {
      // 1. Fetch available quotes
      const quotesRes = await api.getQuotes();
      const allQuotes = quotesRes.quotes || [];

      // 2. Filter candidates for this pantry item that are in stock
      const pantryItem = pantryItems.find(p => p.id === rec.itemId);
      const candidates = allQuotes
        .filter(q => q.pantryItemId === rec.itemId && q.inStock)
        .map(q => ({
          ...q,
          storeId: (['blinkit', 'zepto', 'instamart'].includes(q.storeId) ? q.storeId : 'blinkit') as StoreProduct['storeId'],
          source: (q.source === 'channel3' ? 'channel3' : 'mock') as StoreProduct['source'],
        }));

      if (candidates.length === 0) {
        setAiErrors(prev => ({
          ...prev,
          [rec.itemId]: 'No other in-stock alternates found in local quick-commerce stores.',
        }));
        return;
      }

      // 3. Request AI substitution recommendation
      const aiRes = await api.substituteAI({
        pantryItemId: rec.itemId,
        itemName: rec.itemName,
        preferredBrand: pantryItem?.preferredBrand || rec.selectedProduct?.brand || 'Preferred',
        candidates: candidates as any,
        reason: 'Preferred brand is out of stock',
      });

      setAiSuggestions(prev => ({
        ...prev,
        [rec.itemId]: aiRes.substitute,
      }));
    } catch (err: any) {
      setAiErrors(prev => ({
        ...prev,
        [rec.itemId]: err.message || 'Could not fetch AI alternative',
      }));
    } finally {
      setAiLoadingItemId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
            <span>Approvals & Swaps</span>
            {pendingApprovals.length > 0 && (
              <Badge variant="warning" size="sm">
                {pendingApprovals.length} waiting
              </Badge>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Confirm brand substitutions or out-of-stock alternates before placing your order.
          </p>
        </div>

        {/* Prominent "Approve all swaps" button if multiple items are waiting */}
        {pendingApprovals.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            isLoading={isLoading}
            onClick={approveRun}
            icon={<Check className="w-3.5 h-3.5" />}
          >
            {pendingApprovals.length > 1
              ? `Approve all swaps (${pendingApprovals.length})`
              : 'Approve swap'}
          </Button>
        )}
      </div>

      {/* Main List or Empty State */}
      {pendingApprovals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
          title="All caught up — no items need your review"
          description="Your household restock rules are in place and no substitutions need confirmation right now."
        />
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map(rec => {
            const pantryItem = pantryItems.find(p => p.id === rec.itemId);

            // Find the actual line in the current basket strategy
            const basketLine = currentStrategy?.storeBaskets
              ?.flatMap(b => b.items.map(item => ({ ...item, storeName: b.storeName, storeId: b.storeId })))
              .find(i => i.pantryItemId === rec.itemId);

            const product = basketLine?.product || rec.selectedProduct;
            const storeName = basketLine?.storeName || rec.selectedStore;
            const qty = basketLine ? basketLine.quantity : rec.recommendedQuantity || 1;
            const totalPrice = basketLine ? basketLine.totalPaise : (product ? product.pricePaise * qty : 0);

            const aiSuggestion = aiSuggestions[rec.itemId];
            const isAiLoading = aiLoadingItemId === rec.itemId;
            const aiError = aiErrors[rec.itemId];

            return (
              <Card
                key={rec.itemId}
                variant="elevated"
                className="border-amber-200/80 bg-gradient-to-br from-amber-50/20 to-white space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left: Info & Explanation */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{rec.itemName}</span>
                      <Badge variant="warning" size="sm" icon={<RefreshCw className="w-3 h-3" />}>
                        Brand Swap Needed
                      </Badge>
                      {rec.isUrgent && (
                        <Badge variant="danger" size="sm" icon={<AlertTriangle className="w-3 h-3" />}>
                          {getFriendlyStockUrgencyLabel(rec.daysRemaining)}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {rec.reasoning ||
                        `Your preferred brand was unavailable. ShopPilot selected an in-stock alternate from ${storeName}.`}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      {pantryItem?.preferredBrand && (
                        <span>
                          Preferred:{' '}
                          <strong className="text-slate-800">{pantryItem.preferredBrand}</strong>
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        Pantry remaining:{' '}
                        <strong className="text-slate-800">
                          {formatQuantityWithUnit(rec.currentQuantity, rec.unit)}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Suggested restock:{' '}
                        <strong className="text-slate-800">{qty} {rec.unit}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Middle: Proposed Product Card */}
                  {product && (
                    <div className="bg-white rounded-xl border border-slate-200 p-3 text-xs w-full lg:w-64 space-y-1.5 shadow-2xs shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                        <span>Proposed Item</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold capitalize">
                          {storeName}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900 leading-snug">{product.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Brand: <strong className="text-slate-700">{product.brand}</strong></span>
                        <span className="font-bold text-slate-900 font-sans tabular-nums">
                          {formatPaise(totalPrice)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Right: Individual Item Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2 shrink-0 justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => approveRecommendation(rec.itemId)}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      Approve swap
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={isAiLoading}
                      onClick={() => handleSuggestAiAlternate(rec)}
                      icon={<Sparkles className="w-3.5 h-3.5 text-brand-600" />}
                    >
                      Suggest AI alternate brand
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rejectRecommendation(rec.itemId)}
                      icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
                    >
                      Defer to next week
                    </Button>
                  </div>
                </div>

                {/* AI Alternate Proposal Card (when requested) */}
                {aiSuggestion && (
                  <div className="bg-brand-50/60 border border-brand-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-brand-900">
                        <Bot className="w-4 h-4 text-brand-600" />
                        <span>AI Alternate Brand Recommendation</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                        {Math.round(aiSuggestion.confidence * 100)}% match confidence
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-lg p-2.5 border border-brand-100">
                      <div>
                        <div className="font-semibold text-slate-900">{aiSuggestion.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          Brand: <strong className="text-slate-700">{aiSuggestion.brand}</strong> •{' '}
                          <span className="font-sans tabular-nums font-semibold text-slate-800">
                            {formatPaise(aiSuggestion.pricePaise)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approveRecommendation(rec.itemId)}
                        icon={<Check className="w-3.5 h-3.5" />}
                      >
                        Accept this alternate
                      </Button>
                    </div>

                    <p className="text-[11px] text-brand-800 italic">
                      "{aiSuggestion.reasoning}"
                    </p>
                  </div>
                )}

                {aiError && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                    {aiError}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
