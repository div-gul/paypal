import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import {
  Calendar,
  Sliders,
  DollarSign,
  BellRing,
  ShieldAlert,
  Sparkles,
  Bot,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import { formatPaise, inrToPaise, paiseToInr } from '../services/currency';
import { getDaysUntilNextShoppingRun } from '../services/restockScheduler';
import { api, AiPolicyProposal } from '../api/client';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WeeklyScheduler: React.FC = () => {
  const { schedulerConfig, updateSchedulerConfig, simulationState, optimizationResult } = useShopPilot();

  // Natural language policy state
  const [nlPrompt, setNlPrompt] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiPolicyProposal | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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
  const budgetRatio = Math.min(100, Math.round((currentSpendPaise / schedulerConfig.perCycleBudgetPaise) * 100));

  const handleParseAiPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlPrompt.trim()) return;

    setIsParsingAi(true);
    setAiError(null);
    try {
      const res = await api.parsePolicyAI(nlPrompt);
      setAiProposal(res.proposal);
    } catch (err: any) {
      setAiError(err.message || 'Failed to parse natural language policy with AI');
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleApplyAiProposal = async () => {
    if (!aiProposal) return;

    const updates: any = {};
    if (aiProposal.preferredShoppingDay !== undefined) updates.preferredShoppingDay = aiProposal.preferredShoppingDay;
    if (aiProposal.shoppingFrequency !== undefined) updates.shoppingFrequency = aiProposal.shoppingFrequency;
    if (aiProposal.emergencyRestockPreference !== undefined) updates.emergencyRestockPreference = aiProposal.emergencyRestockPreference;
    if (aiProposal.urgentThresholdDays !== undefined) updates.urgentThresholdDays = aiProposal.urgentThresholdDays;
    if (aiProposal.perCycleBudgetPaise !== undefined) updates.perCycleBudgetPaise = aiProposal.perCycleBudgetPaise;
    if (aiProposal.perOrderCapPaise !== undefined) updates.perOrderCapPaise = aiProposal.perOrderCapPaise;
    if (aiProposal.requireApprovalBrandSubstitution !== undefined)
      updates.requireApprovalBrandSubstitution = aiProposal.requireApprovalBrandSubstitution;
    if (aiProposal.blockedCategories !== undefined) updates.blockedCategories = aiProposal.blockedCategories;

    await updateSchedulerConfig(updates);
    setAiProposal(null);
    setNlPrompt('');
  };

  return (
    <div className="space-y-5">
      {/* AI Natural Language Policy Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl p-5 text-white shadow-md border border-indigo-700/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center border border-indigo-400/30">
            <Bot className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>Natural Language Restock Policy (Server AI)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                AI Powered
              </span>
            </h3>
            <p className="text-xs text-indigo-200">
              Describe your desired grocery shopping habits, budgets, and constraints in plain English.
            </p>
          </div>
        </div>

        <form onSubmit={handleParseAiPolicy} className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            placeholder='e.g. "Order weekly on Sundays with a ₹3500 budget and always ask for approval before emergency orders."'
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={isParsingAi || !nlPrompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isParsingAi ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>Parse Policy with AI</span>
              </>
            )}
          </button>
        </form>

        {aiError && (
          <div className="mt-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg p-2.5">
            {aiError}
          </div>
        )}
      </div>

      {/* Manual Configuration Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              Weekly Restocking Scheduler
            </h2>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
              Next Restock Run
            </span>
            <span className="text-xs font-bold text-slate-900 bg-brand-50 text-brand-800 border border-brand-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              {formattedNextDate} (in {daysUntilNextRun} days)
            </span>
          </div>
        </div>

        {/* Control Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Preferred Shopping Day */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              Preferred Shopping Day
            </label>
            <select
              value={schedulerConfig.preferredShoppingDay}
              onChange={e => updateSchedulerConfig({ preferredShoppingDay: parseInt(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              {DAYS_OF_WEEK.map((day, idx) => (
                <option key={day} value={idx}>
                  Every {day}
                </option>
              ))}
            </select>
          </div>

          {/* Shopping Frequency */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Cadence Frequency
            </label>
            <select
              value={schedulerConfig.shoppingFrequency}
              onChange={e =>
                updateSchedulerConfig({ shoppingFrequency: e.target.value as 'weekly' | 'biweekly' })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="weekly">Weekly (Every 7 days)</option>
              <option value="biweekly">Bi-weekly (Every 14 days)</option>
            </select>
          </div>

          {/* Emergency Restocking Preference */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 flex items-center gap-1">
              <BellRing className="w-3.5 h-3.5 text-slate-500" />
              Off-Cycle Urgent Restock
            </label>
            <select
              value={schedulerConfig.emergencyRestockPreference}
              onChange={e =>
                updateSchedulerConfig({
                  emergencyRestockPreference: e.target.value as 'ask_approval' | 'auto_order' | 'alert_only',
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="ask_approval">Ask Approval (Deliver fee notice)</option>
              <option value="auto_order">Auto-Order Urgents Immediately</option>
              <option value="alert_only">Alert Only (Wait for weekly run)</option>
            </select>
          </div>

          {/* Per-Cycle Budget */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              Cycle Spending Limit
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold">₹</span>
              <input
                type="number"
                step="100"
                min="500"
                value={paiseToInr(schedulerConfig.perCycleBudgetPaise)}
                onChange={e =>
                  updateSchedulerConfig({
                    perCycleBudgetPaise: inrToPaise(Math.max(500, parseFloat(e.target.value) || 500)),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Budget Utilization Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex-1 max-w-xl">
            <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
              <span>Proposed Basket Spend vs Limit</span>
              <span>
                {formatPaise(currentSpendPaise)} / {formatPaise(schedulerConfig.perCycleBudgetPaise)} ({budgetRatio}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  budgetRatio > 90 ? 'bg-rose-500' : budgetRatio > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetRatio)}%` }}
              ></div>
            </div>
          </div>

          {currentSpendPaise > schedulerConfig.perCycleBudgetPaise && (
            <div className="flex items-center gap-1 text-rose-700 font-semibold text-xs bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              Budget limit exceeded! Purchases require approval.
            </div>
          )}
        </div>
      </div>

      {/* AI Proposal Confirmation Modal */}
      {aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Review AI Policy Proposal</h3>
                  <p className="text-[11px] text-slate-500">Extracted from natural language prompt</p>
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
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-indigo-950">
                <span className="font-bold block mb-1">AI Rationale:</span>
                <p className="text-indigo-900 leading-relaxed">{aiProposal.explanation}</p>
              </div>

              {aiProposal.changesSummary && aiProposal.changesSummary.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800 block mb-1">Configured Modifications:</span>
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
              <button
                onClick={() => setAiProposal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAiProposal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Policy Updates</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
