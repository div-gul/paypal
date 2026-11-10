import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { paiseToInr, inrToPaise, formatPaise } from '../services/currency';
import { Card, Button, Badge } from './ui';
import {
  SlidersHorizontal,
  Bot,
  Sparkles,
  Calendar,
  DollarSign,
  BellRing,
  Shield,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { DeliveryAddressManager } from './DeliveryAddressManager';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const HouseholdRules: React.FC = () => {
  const { schedulerConfig, updateSchedulerConfig, simulationState, optimizationResult, isLoading } =
    useShopPilot();

  const [nlPrompt, setNlPrompt] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<{
    proposal: any;
    explanation: string;
    changesSummary: string[];
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Calculate formatted next shopping date
  const nextDate = new Date(schedulerConfig.nextShoppingDate);
  const formattedNextDate = nextDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Calculate days until next run relative to the current simulated date
  const simDate = new Date(simulationState.simulatedDate);
  const diffTime = nextDate.getTime() - simDate.getTime();
  const daysUntilNextRun = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const currentSpendPaise =
    optimizationResult?.recommendedStrategy?.grandTotalPaise || 0;
  const budgetRatio = Math.round(
    (currentSpendPaise / Math.max(1, schedulerConfig.perCycleBudgetPaise)) * 100
  );

  const triggerSuccessNotice = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleParseAiPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlPrompt.trim()) return;

    setIsParsingAi(true);
    setAiError(null);

    try {
      const res = await api.parsePolicyAI(nlPrompt);
      if (res.proposal) {
        setAiProposal({
          proposal: res.proposal,
          explanation: res.proposal.explanation || 'Interpreted policy guidelines from your input.',
          changesSummary: res.proposal.changesSummary || [],
        });
      }
    } catch (err: any) {
      setAiError(err.message || 'Could not parse rule update.');
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleApplyAiProposal = async () => {
    if (!aiProposal) return;
    try {
      await updateSchedulerConfig(aiProposal.proposal);
      setAiProposal(null);
      setNlPrompt('');
      triggerSuccessNotice();
    } catch (err: any) {
      setAiError(err.message || 'Could not save updated rules.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-secondary-tint pb-4">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-brand" />
            <span>Autonomous Restock Rules & Policies</span>
          </h2>
        </div>

        {savedSuccess && (
          <Badge variant="success" size="md" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            Settings updated
          </Badge>
        )}
      </div>

      {/* AI Plain English Assistant Card (Styled in Secondary Slate) */}
      <div className="bg-secondary text-white rounded-xl p-5 shadow-soft border border-secondary space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 text-secondary-tint">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>Tell ShopPilot How Your Household Shops</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                AI Assistant
              </span>
            </h3>
          </div>
        </div>

        <form onSubmit={handleParseAiPolicy} className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            placeholder='e.g. "Order weekly on Thursdays with a ₹3,500 budget and ask before brand swaps."'
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-tint min-h-[44px]"
          />
          <button
            type="submit"
            disabled={isParsingAi || !nlPrompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-surface hover:bg-paper text-ink font-bold text-xs shadow-soft transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 min-h-[44px]"
          >
            {isParsingAi ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-ink border-t-transparent rounded-full animate-spin"></span>
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-secondary" />
                <span>Update with AI</span>
              </>
            )}
          </button>
        </form>

        {aiError && (
          <div className="text-xs text-white bg-danger/80 border border-danger rounded-xl p-2.5">
            {aiError}
          </div>
        )}
      </div>

      {/* Schedule & Timing Card */}
      <Card variant="elevated" className="p-5 space-y-4 border-secondary-tint">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-secondary-tint pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand" />
            <h3 className="font-bold text-sm text-ink">Restock Schedule</h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span>Next delivery planned for:</span>
            <span className="font-bold text-brand bg-brand-tint border border-brand/20 px-2 py-0.5 rounded-md tabular-nums">
              {formattedNextDate} (in {daysUntilNextRun} days)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Preferred Day */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-ink">Preferred Shopping Day</label>
            <select
              value={schedulerConfig.preferredShoppingDay}
              onChange={e => {
                updateSchedulerConfig({ preferredShoppingDay: parseInt(e.target.value) });
                triggerSuccessNotice();
              }}
              className="w-full px-3 py-2 rounded-xl border border-secondary-tint bg-surface font-medium text-ink focus-visible:ring-2 focus-visible:ring-brand cursor-pointer min-h-[44px]"
            >
              {DAYS_OF_WEEK.map((day, idx) => (
                <option key={day} value={idx}>
                  Every {day}
                </option>
              ))}
            </select>
          </div>

          {/* Cadence */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-ink">Restock Frequency</label>
            <select
              value={schedulerConfig.shoppingFrequency}
              onChange={e => {
                updateSchedulerConfig({ shoppingFrequency: e.target.value as 'weekly' | 'biweekly' });
                triggerSuccessNotice();
              }}
              className="w-full px-3 py-2 rounded-xl border border-secondary-tint bg-surface font-medium text-ink focus-visible:ring-2 focus-visible:ring-brand cursor-pointer min-h-[44px]"
            >
              <option value="weekly">Weekly (Every 7 days)</option>
              <option value="biweekly">Bi-weekly (Every 14 days)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Budget & Spending Limits Card */}
      <Card variant="elevated" className="p-5 space-y-4 border-secondary-tint">
        <div className="flex items-center gap-2 border-b border-secondary-tint pb-3">
          <DollarSign className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-ink">Spending Guidelines</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Weekly Budget Cap */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-ink">Weekly Cycle Budget Limit</label>
            <div className="flex items-center gap-2">
              <span className="text-ink-muted font-bold text-sm">₹</span>
              <input
                type="number"
                step="100"
                min="500"
                value={paiseToInr(schedulerConfig.perCycleBudgetPaise)}
                onChange={e => {
                  const val = Math.max(500, parseFloat(e.target.value) || 500);
                  updateSchedulerConfig({ perCycleBudgetPaise: inrToPaise(val) });
                  triggerSuccessNotice();
                }}
                className="w-full px-3 py-2 rounded-xl border border-secondary-tint bg-surface font-bold font-sans tabular-nums text-ink focus-visible:ring-2 focus-visible:ring-brand min-h-[44px]"
              />
            </div>
          </div>

          {/* Per-order cap */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-ink">Single Order Cap</label>
            <div className="flex items-center gap-2">
              <span className="text-ink-muted font-bold text-sm">₹</span>
              <input
                type="number"
                step="100"
                min="300"
                value={paiseToInr(schedulerConfig.perOrderCapPaise ?? 150000)}
                onChange={e => {
                  const val = Math.max(300, parseFloat(e.target.value) || 300);
                  updateSchedulerConfig({ perOrderCapPaise: inrToPaise(val) });
                  triggerSuccessNotice();
                }}
                className="w-full px-3 py-2 rounded-xl border border-secondary-tint bg-surface font-bold font-sans tabular-nums text-ink focus-visible:ring-2 focus-visible:ring-brand min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* Budget Utilization Meter */}
        <div className="pt-2 border-t border-secondary-tint space-y-1.5 text-xs">
          <div className="flex justify-between text-[11px] font-semibold text-ink">
            <span>Current Proposed Order vs Budget Limit</span>
            <span className="font-sans tabular-nums">
              {formatPaise(currentSpendPaise)} of {formatPaise(schedulerConfig.perCycleBudgetPaise)} ({budgetRatio}%)
            </span>
          </div>
          <div className="w-full bg-paper border border-secondary-tint h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                budgetRatio > 90 ? 'bg-danger' : budgetRatio > 70 ? 'bg-accent' : 'bg-good'
              }`}
              style={{ width: `${Math.min(100, budgetRatio)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Substitutions & Emergency Restocks Card */}
      <Card variant="elevated" className="p-5 space-y-4 border-secondary-tint">
        <div className="flex items-center gap-2 border-b border-secondary-tint pb-3">
          <BellRing className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-ink">Substitutions & Emergency Handling</h3>
        </div>

        <div className="space-y-4 text-xs">
          {/* Emergency Restock Behavior */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-ink">Emergency Restock Behavior</label>
            <select
              value={schedulerConfig.emergencyRestockPreference}
              onChange={e => {
                updateSchedulerConfig({
                  emergencyRestockPreference: e.target.value as 'ask_approval' | 'auto_order' | 'alert_only',
                });
                triggerSuccessNotice();
              }}
              className="w-full px-3 py-2 rounded-xl border border-secondary-tint bg-surface font-medium text-ink focus-visible:ring-2 focus-visible:ring-brand cursor-pointer min-h-[44px]"
            >
              <option value="ask_approval">Ask for my confirmation first (Recommended)</option>
              <option value="auto_order">Order immediately if stock hits 0</option>
              <option value="alert_only">Alert only, wait for weekly shopping day</option>
            </select>
          </div>

          {/* Brand Swap Policy */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-secondary-tint hover:bg-paper transition cursor-pointer">
            <input
              type="checkbox"
              checked={schedulerConfig.requireApprovalBrandSubstitution ?? true}
              onChange={e => {
                updateSchedulerConfig({ requireApprovalBrandSubstitution: e.target.checked });
                triggerSuccessNotice();
              }}
              className="rounded text-brand focus:ring-brand w-4 h-4 cursor-pointer shrink-0"
            />
            <span className="font-semibold text-ink text-xs flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-secondary" />
              Always ask before swapping brands
            </span>
          </label>
        </div>
      </Card>

      <DeliveryAddressManager />

      {/* AI Proposal Review Modal */}
      {aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-6 shadow-card border border-secondary-tint space-y-4">
            <div className="flex items-center justify-between border-b border-secondary-tint pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-secondary-tint text-secondary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-sm">
                    Review Suggested Settings Updates
                  </h3>
                  <p className="text-[11px] text-ink-muted">Interpreted from your instructions</p>
                </div>
              </div>
              <button
                onClick={() => setAiProposal(null)}
                className="text-ink-muted hover:text-ink p-2 rounded-xl hover:bg-secondary-tint/50 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-secondary-tint/40 border border-secondary-tint rounded-xl p-3 text-ink">
                <span className="font-bold text-secondary block mb-1">Summary:</span>
                <p className="text-ink-muted leading-relaxed">{aiProposal.explanation}</p>
              </div>

              {aiProposal.changesSummary && aiProposal.changesSummary.length > 0 && (
                <div>
                  <span className="font-bold text-ink block mb-1">Proposed Updates:</span>
                  <ul className="space-y-1 list-disc list-inside text-ink-muted">
                    {aiProposal.changesSummary.map((change, idx) => (
                      <li key={idx} className="font-medium">
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-secondary-tint">
              <Button variant="outline" size="sm" onClick={() => setAiProposal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isLoading}
                onClick={handleApplyAiProposal}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Apply Updates
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
