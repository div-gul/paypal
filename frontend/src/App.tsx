import React, { useState } from 'react';
import { ShopPilotProvider } from './context/ShopPilotContext';
import { Header } from './components/Header';
import { TimeMachine } from './components/TimeMachine';
import { PantryManager } from './components/PantryManager';
import { WeeklyScheduler } from './components/WeeklyScheduler';
import { OverviewAnalytics } from './components/OverviewAnalytics';
import { ShoppingAnalysis } from './components/ShoppingAnalysis';
import { BasketOptimizer } from './components/BasketOptimizer';
import { StoreComparison } from './components/StoreComparison';
import { CheckoutModal } from './components/CheckoutModal';
import { IntegrationInfoModal } from './components/IntegrationInfoModal';
import { BackendHealthBadge } from './components/BackendHealthBadge';
import {
  Layers,
  Sparkles,
  TrendingDown,
  Calendar,
  LayoutDashboard,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useShopPilot } from './context/ShopPilotContext';

type ActiveView = 'dashboard' | 'pantry' | 'scheduler' | 'analysis' | 'basket-stores';

const MainLayout: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const { isLoading, error, clearError, reloadState } = useShopPilot();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter',sans-serif]">
      {/* Sticky Header */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Alert Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs">
                <strong>Backend Sync Error:</strong> {error}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => reloadState()}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              <button
                onClick={clearError}
                className="text-xs text-rose-700 hover:text-rose-900 px-2 py-1 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Global Loading Bar */}
        {isLoading && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center justify-center gap-2 text-brand-900 text-xs font-medium">
            <span className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></span>
            <span>Syncing state with backend server...</span>
          </div>
        )}

        {/* Simulation Clock Controls */}
        <TimeMachine />

        {/* View Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'dashboard'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveView('pantry')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'pantry'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pantry</span>
          </button>

          <button
            onClick={() => setActiveView('scheduler')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'scheduler'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Scheduler</span>
          </button>

          <button
            onClick={() => setActiveView('analysis')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'analysis'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Restock Decisions</span>
          </button>

          <button
            onClick={() => setActiveView('basket-stores')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'basket-stores'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Basket & Stores</span>
          </button>
        </div>

        {/* View Renderings */}
        {activeView === 'dashboard' && <OverviewAnalytics />}

        {activeView === 'pantry' && <PantryManager />}
        {activeView === 'scheduler' && <WeeklyScheduler />}
        {activeView === 'analysis' && <ShoppingAnalysis />}
        {activeView === 'basket-stores' && (
          <div className="space-y-6">
            <BasketOptimizer />
            <StoreComparison />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span className="font-semibold text-slate-700">ShopPilot AI</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span>Autonomous Restocking Agent</span>
          </div>
          <div className="flex items-center gap-4">
            <BackendHealthBadge />
            <span className="text-[11px] text-slate-400">PayPal Hackathon</span>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      <CheckoutModal />
      <IntegrationInfoModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ShopPilotProvider>
      <MainLayout />
    </ShopPilotProvider>
  );
};

export default App;
