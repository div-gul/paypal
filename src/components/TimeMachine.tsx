import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { FastForward, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { getDaysUntilNextShoppingRun } from '../services/restockScheduler';

export const TimeMachine: React.FC = () => {
  const {
    simulationState,
    schedulerConfig,
    advanceTime,
    runShoppingAnalysis,
    isAnalyzing,
  } = useShopPilot();

  const [advancing, setAdvancing] = useState<number | null>(null);

  const daysUntilNextRun = getDaysUntilNextShoppingRun(
    simulationState.simulatedDate,
    schedulerConfig.nextShoppingDate
  );

  const handleAdvance = async (days: number) => {
    setAdvancing(days);
    await advanceTime(days);
    setAdvancing(null);
  };

  const simDateObj = new Date(simulationState.simulatedDate);
  const formattedSimDate = simDateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 text-white shadow-lg border border-slate-700">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left Side: Clock & Explainer */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              <Clock className="w-3.5 h-3.5" /> Simulation Time Machine
            </span>
            <span className="text-xs text-slate-400">
              (Demonstration Feature — Test household burn rates)
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3 pt-1">
            <h2 className="text-2xl font-bold tracking-tight text-white font-mono">
              {formattedSimDate}
            </h2>
            <div className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-slate-200 flex items-center gap-1.5 font-medium">
              <span>Days Elapsed: <strong>{simulationState.daysElapsed}d</strong></span>
              <span className="text-white/40">•</span>
              <span>Next Weekly Run: <strong>in {daysUntilNextRun} day{daysUntilNextRun === 1 ? '' : 's'}</strong></span>
            </div>
          </div>

          <p className="text-xs text-slate-300 max-w-2xl pt-0.5 leading-relaxed">
            Advancing simulated time consumes pantry items at their configured daily rates.
            Watch items shift from safe stock to urgent warnings as stock depletes before the scheduled run.
          </p>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => handleAdvance(1)}
            disabled={advancing !== null || isAnalyzing}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-600 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm hover:border-slate-500"
          >
            <FastForward className="w-3.5 h-3.5 text-brand-400" />
            <span>+1 Day</span>
          </button>

          <button
            onClick={() => handleAdvance(3)}
            disabled={advancing !== null || isAnalyzing}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-600 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm hover:border-slate-500"
          >
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            <span>+3 Days</span>
          </button>

          <button
            onClick={() => handleAdvance(7)}
            disabled={advancing !== null || isAnalyzing}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-brand-600/30"
          >
            <FastForward className="w-3.5 h-3.5 text-white" />
            <span>+7 Days (1 Cycle)</span>
          </button>

          <button
            onClick={runShoppingAnalysis}
            disabled={isAnalyzing || advancing !== null}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/30"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                Run Shopping Analysis
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stockout Alert Indicator if any item is at 0 */}
      {simulationState.daysElapsed > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-2 text-xs text-slate-300">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Simulated consumption is active. Review the updated pantry inventory below or inspect restocking recommendations prepared for the next shopping cycle.
          </span>
        </div>
      )}
    </div>
  );
};
