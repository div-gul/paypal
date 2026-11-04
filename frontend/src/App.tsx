import React, { useState, useEffect, useRef } from 'react';
import { ShopPilotProvider, useShopPilot } from './context/ShopPilotContext';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { ApprovalsView } from './components/ApprovalsView';
import { PantryManager } from './components/PantryManager';
import { HouseholdRules } from './components/HouseholdRules';
import { DemoDrawer } from './components/DemoDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { IntegrationInfoModal } from './components/IntegrationInfoModal';
import { BackendHealthBadge } from './components/BackendHealthBadge';
import { api } from './api/client';
import { Badge } from './components/ui/Badge';
import {
  Home,
  CheckSquare,
  Package,
  Settings,
  Sliders,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'approvals' | 'pantry' | 'settings'>('home');
  const [isDemoDrawerOpen, setIsDemoDrawerOpen] = useState(false);
  const {
    error,
    clearError,
    reloadState,
    pendingSwaps,
    isUpcomingOrderSaved,
    openCheckoutModal,
    closeCheckoutModal,
    cancelPayPalOrder,
    isLoading,
  } = useShopPilot();

  const handledPayPalReturn = useRef<string>('');

  // Handle return from PayPal Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const returnAction = params.get('paypal');
    const runId = params.get('runId');
    if (!returnAction || !runId) return;
    const key = `${returnAction}:${runId}:${params.get('token') || ''}`;
    if (handledPayPalReturn.current === key) return;
    handledPayPalReturn.current = key;
    window.history.replaceState({}, '', window.location.pathname);

    if (returnAction === 'return') {
      void api.getRun(runId).then(({ run }) => {
        if (run.selectedStrategyDetails) {
          setActiveTab('home');
          openCheckoutModal(run.selectedStrategyDetails, runId);
        }
      }).catch(err => console.warn('PayPal return recovery notice:', err));
    } else if (returnAction === 'cancel') {
      void cancelPayPalOrder(runId, params.get('token') || undefined).catch(err => {
        console.warn('PayPal cancellation status notice:', err);
      });
    }
  }, [openCheckoutModal, cancelPayPalOrder]);

  // Number of items needing review in Approvals tab:
  // 1. Any pending product swaps
  // 2. 1 while the editable order still needs to be saved
  const pendingApprovalsCount = pendingSwaps.length + (isUpcomingOrderSaved ? 0 : 1);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      {/* Demo Mode Top Banner (Slate with white text) */}
      <div className="bg-secondary text-white text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2">
        <span>Demo mode — simulated quick-commerce prices and PayPal sandbox. No real money or delivery.</span>
      </div>

      {/* Top Header */}
      <Header onOpenDemoDrawer={() => setIsDemoDrawerOpen(true)} />

      {/* Main Shell Container with Desktop Sidebar + Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col justify-between w-60 shrink-0 space-y-6">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-3 mb-2 block">
              Navigation
            </span>

            {/* Tab: Home */}
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                activeTab === 'home'
                  ? 'bg-brand text-white shadow-soft'
                  : 'text-ink-muted hover:text-ink hover:bg-secondary-tint/50'
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
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                activeTab === 'approvals'
                  ? 'bg-brand text-white shadow-soft'
                  : 'text-ink-muted hover:text-ink hover:bg-secondary-tint/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4 h-4" />
                <span>Approvals</span>
              </div>
              {pendingApprovalsCount > 0 && (
                <Badge
                  variant={activeTab === 'approvals' ? 'neutral' : 'count'}
                  className={activeTab === 'approvals' ? 'bg-white text-brand' : ''}
                >
                  {pendingApprovalsCount}
                </Badge>
              )}
            </button>

            {/* Tab: Pantry */}
            <button
              onClick={() => setActiveTab('pantry')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                activeTab === 'pantry'
                  ? 'bg-brand text-white shadow-soft'
                  : 'text-ink-muted hover:text-ink hover:bg-secondary-tint/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4" />
                <span>Pantry</span>
              </div>
            </button>

            {/* Tab: Settings behind gear icon */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                  activeTab === 'settings'
                    ? 'bg-brand text-white shadow-soft'
                    : 'text-ink-muted hover:text-ink hover:bg-secondary-tint/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </div>
              </button>
            </div>
          </div>

          {/* Sidebar Footer Card: Demo Trigger & System Health */}
          <div className="rounded-xl border border-secondary-tint bg-surface p-3.5 space-y-3 shadow-soft">
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span className="font-semibold text-ink">System Mode</span>
              <BackendHealthBadge />
            </div>

            <button
              onClick={() => setIsDemoDrawerOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl border border-secondary-tint hover:bg-secondary-tint/40 text-ink font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition min-h-[44px]"
            >
              <Sliders className="w-3.5 h-3.5 text-secondary" />
              <span>Simulation Controls</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 pb-20 md:pb-6 space-y-6">
          {/* Error Alert Banner */}
          {error && (
            <div className="bg-danger/10 border border-danger/25 rounded-xl p-4 flex items-center justify-between gap-3 text-danger shadow-soft">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-danger shrink-0" />
                <div className="text-xs">
                  <strong>Notice:</strong> {error}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => reloadState()}
                  className="px-3.5 py-2 rounded-xl bg-danger hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-soft min-h-[44px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
                <button
                  onClick={clearError}
                  className="text-xs text-danger/80 hover:text-danger px-2.5 py-2 cursor-pointer min-h-[44px] flex items-center"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Syncing indicator */}
          {isLoading && (
            <div className="bg-secondary-tint border border-secondary/20 rounded-xl p-2.5 flex items-center justify-center gap-2 text-secondary text-xs font-medium">
              <span className="w-3.5 h-3.5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
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

      {/* Mobile Bottom Navigation Bar (390px mobile viewport tested) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-secondary-tint px-3 py-1.5 shadow-card flex items-center justify-around"
      >
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] min-h-[44px] ${
            activeTab === 'home' ? 'text-brand font-bold' : 'text-ink-muted font-medium'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`relative flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] min-h-[44px] ${
            activeTab === 'approvals' ? 'text-brand font-bold' : 'text-ink-muted font-medium'
          }`}
        >
          <div className="relative">
            <CheckSquare className="w-5 h-5" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-accent text-white rounded-full text-[9px] font-extrabold w-4 h-4 flex items-center justify-center shadow-soft">
                {pendingApprovalsCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Approvals</span>
        </button>

        <button
          onClick={() => setActiveTab('pantry')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] min-h-[44px] ${
            activeTab === 'pantry' ? 'text-brand font-bold' : 'text-ink-muted font-medium'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">Pantry</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer min-w-[56px] min-h-[44px] ${
            activeTab === 'settings' ? 'text-brand font-bold' : 'text-ink-muted font-medium'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
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
