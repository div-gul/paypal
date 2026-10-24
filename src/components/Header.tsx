import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { Bot, RefreshCw, Info, Calendar, ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => {
  const { simulationState, schedulerConfig, resetToInitialDemo, setShowDemoInfoModal } = useShopPilot();

  const simDate = new Date(simulationState.simulatedDate);
  const formattedSimDate = simDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const nextRunDate = new Date(schedulerConfig.nextShoppingDate);
  const formattedNextRun = nextRunDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Demo Mode Notice Banner */}
      <div className="bg-amber-600 text-white text-xs font-medium py-1 px-4 text-center flex items-center justify-center gap-2">
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-white text-amber-800 uppercase tracking-wider">
          Demo Mode
        </span>
        <span>Simulated store prices for Blinkit, Zepto, and Instamart.</span>
        <button
          onClick={() => setShowDemoInfoModal(true)}
          className="underline hover:text-amber-100 flex items-center gap-1 ml-1 cursor-pointer font-semibold"
        >
          <Info className="w-3.5 h-3.5" /> Data Boundaries
        </button>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">ShopPilot AI</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Autonomous Agent
              </span>
            </div>
          </div>
        </div>

        {/* Live Simulation Clock & Next Run Indicator */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Calendar className="w-4 h-4 text-brand-600" />
              <div>
                <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Simulated Date</span>
                <span className="font-semibold text-slate-800">{formattedSimDate}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-300"></div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Next Weekly Run</span>
              <span className="font-medium text-slate-700">{formattedNextRun}</span>
            </div>
          </div>

          {/* Reset Demo Button */}
          <button
            onClick={resetToInitialDemo}
            title="Reset simulation and pantry data back to initial benchmark"
            className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Demo
          </button>
        </div>
      </div>
    </header>
  );
};
