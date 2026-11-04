import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { FastForward, Clock, Sparkles } from 'lucide-react';
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
    <div className="bg-brand-dark rounded-xl p-4 text-white shadow-soft border border-brand-dark">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left Side: Clock & Details */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-brand-tint border border-white/20">
              <Clock className="w-3.5 h-3.5" /> Simulation Clock
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3 pt-1">
            <h2 className="text-xl font-bold tracking-tight text-white tabular-nums">
              {formattedSimDate}
            </h2>
            <div className="text-xs px-2.5 py-1 rounded-xl bg-white/10 text-white/90 flex items-center gap-1.5 font-medium tabular-nums">
              <span>Days Elapsed: <strong className="text-white">{simulationState.daysElapsed}d</strong></span>
              <span className="text-white/40">•</span>
              <span>Next Weekly Run: <strong className="text-white">in {daysUntilNextRun} day{daysUntilNextRun === 1 ? '' : 's'}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => handleAdvance(1)}
            disabled={advancing !== null || isAnalyzing}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            <FastForward className="w-3.5 h-3.5 text-brand-tint" />
            <span>+1 Day</span>
          </button>

          <button
            onClick={() => handleAdvance(3)}
            disabled={advancing !== null || isAnalyzing}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            <FastForward className="w-3.5 h-3.5 text-brand-tint" />
            <span>+3 Days</span>
          </button>

          <button
            onClick={() => handleAdvance(7)}
            disabled={advancing !== null || isAnalyzing}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            <FastForward className="w-3.5 h-3.5 text-white" />
            <span>+7 Days</span>
          </button>

          <button
            onClick={runShoppingAnalysis}
            disabled={isAnalyzing || advancing !== null}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-soft min-h-[44px]"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Analyzing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-secondary-tint" />
                <span>Run Analysis</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
