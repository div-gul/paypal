import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import {
  Calendar,
  DollarSign,
  BellRing,
  Sparkles,
  Bot,
  CheckCircle2,
  X,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import { formatPaise, inrToPaise, paiseToInr } from '../services/currency';
import { getDaysUntilNextShoppingRun } from '../services/restockScheduler';
import { api, AiPolicyProposal } from '../api/client';
import { Card, Button, Badge } from './ui';

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

  // Natural language policy state
  const [nlPrompt, setNlPrompt] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiPolicyProposal | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const daysUntilNextRun = getDaysUntilNextShoppingRun(
    simulationState.simulatedDate,
    schedulerConfig.nextShoppingDate
  );

  const nextDateObj = new Date(schedulerConfig.nextShoppingDate);
  const formattedNextDate = nextDateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const currentSpendPaise = optimizationResult?.recommendedStrategy?.grandTotalPaise || 0;
  const budgetRatio = Math.min(
    100,
    Math.round((currentSpendPaise / schedulerConfig.perCycleBudgetPaise) * 100)
  );

  const handleParseAiPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlPrompt.trim()) return;

    setIsParsingAi(true);
    setAiError(null);
    try {
      const res = await api.parsePolicyAI(nlPrompt);
      setAiProposal(res.proposal);
    } catch (err: any) {
      setAiError(err.message || 'Failed to interpret instructions. Please try again.');
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleApplyAiProposal = async () => {
    if (!aiProposal) return;

    const updates: any = {};
    if (aiProposal.preferredShoppingDay !== undefined)
      updates.preferredShoppingDay = aiProposal.preferredShoppingDay;
    if (aiProposal.shoppingFrequency !== undefined)
      updates.shoppingFrequency = aiProposal.shoppingFrequency;
    if (aiProposal.emergencyRestockPreference !== undefined)
      updates.emergencyRestockPreference = aiProposal.emergencyRestockPreference;
    if (aiProposal.urgentThresholdDays !== undefined)
      updates.urgentThresholdDays = aiProposal.urgentThresholdDays;
    if (aiProposal.perCycleBudgetPaise !== undefined)
      updates.perCycleBudgetPaise = aiProposal.perCycleBudgetPaise;
    if (aiProposal.perOrderCapPaise !== undefined)
      updates.perOrderCapPaise = aiProposal.perOrderCapPaise;
    if (aiProposal.requireApprovalBrandSubstitution !== undefined)
      updates.requireApprovalBrandSubstitution = aiProposal.requireApprovalBrandSubstitution;
    if (aiProposal.blockedCategories !== undefined)
      updates.blockedCategories = aiProposal.blockedCategories;

    await updateSchedulerConfig(updates);
    setAiProposal(null);
    setNlPrompt('');
    triggerSuccessNotice();
  };

  const triggerSuccessNotice = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-brand-600" />
            <span>Household Restock Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure your weekly delivery schedule, budget caps, and brand swap preferences.
          </p>
        </div>

        {savedSuccess && (
          <Badge variant="success" size="md" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            Settings updated
          </Badge>
        )}
      </div>

      {/* AI Plain English Assistant Card */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-md border border-brand-600/50 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
            <Bot className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>Tell ShopPilot How Your Household Shops</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-300/20">
                AI Assistant
              </span>
            </h3>
            <p className="text-xs text-indigo-200">
              Type in natural English to automatically adjust your shopping day, budget, and swap rules.
            </p>
          </div>
        </div>

        <form onSubmit={handleParseAiPolicy} className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            placeholder='e.g. "Order weekly on Thursdays with a ₹3,500 budget and ask before brand swaps."'
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="submit"
            disabled={isParsingAi || !nlPrompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isParsingAi ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>Update with AI</span>
              </>
            )}
          </button>
        </form>

        {aiError && (
          <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg p-2.5">
            {aiError}
          </div>
        )}
      </div>

      {/* Schedule & Timing Card */}
      <Card variant="elevated" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900">Restock Schedule</h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Next delivery planned for:</span>
            <span className="font-bold text-brand-800 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md">
              {formattedNextDate} (in {daysUntilNextRun} days)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Preferred Day */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Preferred Shopping Day</label>
            <select
              value={schedulerConfig.preferredShoppingDay}
              onChange={e => {
                updateSchedulerConfig({ preferredShoppingDay: parseInt(e.target.value) });
                triggerSuccessNotice();
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              {DAYS_OF_WEEK.map((day, idx) => (
                <option key={day} value={idx}>
                  Every {day}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              ShopPilot consolidates weekly replenishment orders on this day.
            </p>
          </div>

          {/* Cadence */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Restock Frequency</label>
            <select
              value={schedulerConfig.shoppingFrequency}
              onChange={e => {
                updateSchedulerConfig({ shoppingFrequency: e.target.value as 'weekly' | 'biweekly' });
                triggerSuccessNotice();
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="weekly">Weekly (Every 7 days)</option>
              <option value="biweekly">Bi-weekly (Every 14 days)</option>
            </select>
            <p className="text-[11px] text-slate-500">How often your primary restock basket is prepared.</p>
          </div>
        </div>
      </Card>

      {/* Budget & Spending Limits Card */}
      <Card variant="elevated" className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <DollarSign className="w-4 h-4 text-brand-600" />
          <h3 className="font-bold text-sm text-slate-900">Spending Guidelines</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Weekly Budget Cap */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Weekly Cycle Budget Limit</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-sm">₹</span>
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
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold font-sans tabular-nums text-slate-800 focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-[11px] text-slate-500">Maximum expected total per restock cycle.</p>
          </div>

          {/* Per-order cap */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Single Order Cap</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-sm">₹</span>
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
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold font-sans tabular-nums text-slate-800 focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Orders exceeding this amount require explicit confirmation.
            </p>
          </div>
        </div>

        {/* Budget Utilization Meter */}
        <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
          <div className="flex justify-between text-[11px] font-semibold text-slate-700">
            <span>Current Proposed Order vs Budget Limit</span>
            <span className="font-sans tabular-nums">
              {formatPaise(currentSpendPaise)} of {formatPaise(schedulerConfig.perCycleBudgetPaise)} ({budgetRatio}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                budgetRatio > 90 ? 'bg-rose-500' : budgetRatio > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, budgetRatio)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Substitutions & Emergency Restocks Card */}
      <Card variant="elevated" className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BellRing className="w-4 h-4 text-brand-600" />
          <h3 className="font-bold text-sm text-slate-900">Substitutions & Emergency Handling</h3>
        </div>

        <div className="space-y-4 text-xs">
          {/* Emergency Restock Behavior */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Emergency Restock Behavior</label>
            <select
              value={schedulerConfig.emergencyRestockPreference}
              onChange={e => {
                updateSchedulerConfig({
                  emergencyRestockPreference: e.target.value as 'ask_approval' | 'auto_order' | 'alert_only',
                });
                triggerSuccessNotice();
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="ask_approval">Ask for my confirmation first (Recommended)</option>
              <option value="auto_order">Order immediately if stock hits 0</option>
              <option value="alert_only">Alert only, wait for weekly shopping day</option>
            </select>
            <p className="text-[11px] text-slate-500">
              How ShopPilot should react if an essential item depletes ahead of your scheduled day.
            </p>
          </div>

          {/* Brand Swap Policy */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
            <input
              type="checkbox"
              checked={schedulerConfig.requireApprovalBrandSubstitution ?? true}
              onChange={e => {
                updateSchedulerConfig({ requireApprovalBrandSubstitution: e.target.checked });
                triggerSuccessNotice();
              }}
              className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
            />
            <div>
              <span className="font-semibold text-slate-900 text-xs block flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                Always ask before swapping brands
              </span>
              <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                When checked, if your preferred brand is out of stock, ShopPilot will always ask for your review before placing the order.
              </span>
            </div>
          </label>
        </div>
      </Card>

      {/* AI Proposal Review Modal */}
      {aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-heading">
                    Review Suggested Settings Updates
                  </h3>
                  <p className="text-[11px] text-slate-500">Interpreted from your instructions</p>
                </div>
              </div>
              <button
                onClick={() => setAiProposal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-brand-50/70 border border-brand-100 rounded-xl p-3 text-brand-950">
                <span className="font-bold block mb-1">Summary:</span>
                <p className="text-brand-900 leading-relaxed">{aiProposal.explanation}</p>
              </div>

              {aiProposal.changesSummary && aiProposal.changesSummary.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800 block mb-1">Proposed Updates:</span>
                  <ul className="space-y-1 list-disc list-inside text-slate-700">
                    {aiProposal.changesSummary.map((change, idx) => (
                      <li key={idx} className="font-medium">
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setAiProposal(null)}>
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
