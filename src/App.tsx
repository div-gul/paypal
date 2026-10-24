import React, { useState } from 'react';
import { ShopPilotProvider } from './context/ShopPilotContext';
import { Header } from './components/Header';
import { TimeMachine } from './components/TimeMachine';
import { PantryManager } from './components/PantryManager';
import { WeeklyScheduler } from './components/WeeklyScheduler';
import { ShoppingAnalysis } from './components/ShoppingAnalysis';
import { BasketOptimizer } from './components/BasketOptimizer';
import { StoreComparison } from './components/StoreComparison';
import { ActivityTimeline } from './components/ActivityTimeline';
import { CheckoutModal } from './components/CheckoutModal';
import { IntegrationInfoModal } from './components/IntegrationInfoModal';
import {
  Layers,
  Sparkles,
  TrendingDown,
  Calendar,
  Store,
  History,
  LayoutDashboard,
} from 'lucide-react';

type ActiveView = 'dashboard' | 'pantry' | 'scheduler' | 'analysis' | 'optimizer' | 'stores' | 'activity';

const MainLayout: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter',sans-serif]">
      {/* Sticky Header */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Demonstration Time Machine Controls */}
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
            <span>Full Agent Overview</span>
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
            <span>Pantry Inventory</span>
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
            <span>Weekly Scheduler</span>
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
            onClick={() => setActiveView('optimizer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'optimizer'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Basket Optimizer</span>
          </button>

          <button
            onClick={() => setActiveView('stores')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'stores'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Store Adapters & Catalog</span>
          </button>

          <button
            onClick={() => setActiveView('activity')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeView === 'activity'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Log</span>
          </button>
        </div>

        {/* View Renderings */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Row: Scheduler and Proposed Basket Optimizer */}
            <WeeklyScheduler />
            <ShoppingAnalysis />
            <BasketOptimizer />
            <PantryManager />
            <ActivityTimeline />
          </div>
        )}

        {activeView === 'pantry' && <PantryManager />}
        {activeView === 'scheduler' && <WeeklyScheduler />}
        {activeView === 'analysis' && <ShoppingAnalysis />}
        {activeView === 'optimizer' && <BasketOptimizer />}
        {activeView === 'stores' && <StoreComparison />}
        {activeView === 'activity' && <ActivityTimeline />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ShopPilot AI — Autonomous Weekly Grocery Shopping Agent</span>
          <span>Built for hackathon demonstration with simulated store adapters & PayPal sandbox.</span>
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
