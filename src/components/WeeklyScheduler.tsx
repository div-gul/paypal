import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { Calendar, Sliders, DollarSign, BellRing, ShieldAlert } from 'lucide-react';
import { formatPaise, inrToPaise, paiseToInr } from '../services/currency';
import { getDaysUntilNextShoppingRun } from '../services/restockScheduler';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WeeklyScheduler: React.FC = () => {
  const { schedulerConfig, updateSchedulerConfig, simulationState, optimizationResult } = useShopPilot();

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" />
            Weekly Restocking Scheduler & Purchasing Rules
          </h2>
          <p className="text-xs text-slate-500">
            Configure scheduled run cadence, emergency restock policies, and autonomous budget limits.
          </p>
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
          <span className="text-[11px] text-slate-400 block">
            Scheduled bulk restocking cycle day
          </span>
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
          <span className="text-[11px] text-slate-400 block">
            Agent gathers low stock items into one basket
          </span>
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
          <span className="text-[11px] text-slate-400 block">
            Policy when items run out before weekly date
          </span>
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
          <span className="text-[11px] text-slate-400 block">
            Agent blocks or requests approval if exceeded
          </span>
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
  );
};
