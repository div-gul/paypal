import React, { useState } from 'react';
import { ShopPilotProvider, useShopPilot } from './context/ShopPilotContext';
import { Header } from './components/Header';
import { DemoDrawer } from './components/DemoDrawer';
import { HomeView } from './components/HomeView';
import { PantryManager } from './components/PantryManager';
import { ApprovalsView } from './components/ApprovalsView';
import { HouseholdRules } from './components/HouseholdRules';
import { CheckoutModal } from './components/CheckoutModal';
import { IntegrationInfoModal } from './components/IntegrationInfoModal';
import { BackendHealthBadge } from './components/BackendHealthBadge';
import { Badge } from './components/ui/Badge';
import {
  Home,
  CheckSquare,
  Package,
  AlertCircle,
  RefreshCw,
  Sliders,
  SlidersHorizontal,
} from 'lucide-react';

type MainTab = 'home' | 'approvals' | 'pantry' | 'settings';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [isDemoDrawerOpen, setIsDemoDrawerOpen] = useState(false);
  const {
    isLoading,
    error,
    clearError,
    reloadState,
    recommendations,
    activeRun,
    closeCheckoutModal,
  } = useShopPilot();

  // Calculate pending items needing user confirmation
  const pendingApprovalsCount =
    activeRun?.status === 'approved'
      ? 0
      : recommendations.filter(
          r =>
            r.approvalStatus !== 'approved' &&
            r.approvalStatus !== 'rejected' &&
            (r.requiresApproval || r.isSubstitution)
        ).length;

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col font-['Inter',sans-serif]">
      {/* Top Header */}
      <Header onOpenDemoDrawer={() => setIsDemoDrawerOpen(true)} />

      {/* Main Shell Container with Desktop Sidebar + Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col justify-between w-60 shrink-0 space-y-6">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 block">
              Navigation
            </span>

            {/* Tab: Home */}
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </div>
            </button>

            {/* Tab: Approvals */}
            <button
              onClick={() => setActiveTab('approvals')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4 h-4" />
                <span>Approvals</span>
              </div>
              {pendingApprovalsCount > 0 && (
                <Badge
                  variant={activeTab === 'approvals' ? 'neutral' : 'count'}
                  className={activeTab === 'approvals' ? 'bg-white text-brand-800' : ''}
                >
                  {pendingApprovalsCount}
                </Badge>
              )}
            </button>

            {/* Tab: Pantry */}
            <button
              onClick={() => setActiveTab('pantry')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'pantry'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4" />
                <span>Pantry</span>
              </div>
            </button>

            {/* Tab: Settings / Restock Rules */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Restock Rules</span>
              </div>
            </button>
          </div>

          {/* Sidebar Footer Card: Demo Trigger & System Health */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">System Mode</span>
              <BackendHealthBadge />
            </div>

            <button
              onClick={() => setIsDemoDrawerOpen(true)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Sliders className="w-3.5 h-3.5 text-brand-600" />
              <span>Simulation Controls</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 pb-20 md:pb-6 space-y-6">
          {/* Error Alert Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="text-xs">
                  <strong>Notice:</strong> {error}
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

          {/* Syncing indicator */}
          {isLoading && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-2.5 flex items-center justify-center gap-2 text-brand-900 text-xs font-medium">
              <span className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></span>
              <span>Updating restock plans...</span>
            </div>
          )}

          {/* View Renderings */}
          {activeTab === 'home' && <HomeView onNavigateToTab={setActiveTab} />}

          {activeTab === 'approvals' && <ApprovalsView />}

          {activeTab === 'pantry' && (
            <PantryManager onOpenSettings={() => setActiveTab('settings')} />
          )}

          {activeTab === 'settings' && <HouseholdRules />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (fixed bottom for screens < md) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 shadow-lg flex items-center justify-around"
      >
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] ${
            activeTab === 'home' ? 'text-brand-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`relative flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] ${
            activeTab === 'approvals' ? 'text-brand-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <div className="relative">
            <CheckSquare className="w-5 h-5" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white rounded-full text-[9px] font-extrabold w-4 h-4 flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Approvals</span>
        </button>

        <button
          onClick={() => setActiveTab('pantry')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] ${
            activeTab === 'pantry' ? 'text-brand-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">Pantry</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] ${
            activeTab === 'settings' ? 'text-brand-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="text-[10px]">Rules</span>
        </button>
      </nav>

      {/* Modals & Slide-out Drawers */}
      <DemoDrawer isOpen={isDemoDrawerOpen} onClose={() => setIsDemoDrawerOpen(false)} />
      <CheckoutModal
        onNavigateToApprovals={() => {
          closeCheckoutModal();
          setActiveTab('approvals');
        }}
      />
      <IntegrationInfoModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ShopPilotProvider>
      <MainLayout />
    </ShopPilotProvider>
  );
};

export default App;
