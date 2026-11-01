import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityLogItem,
  BasketItem,
  BasketStrategyResult,
  BasketStrategyType,
  PantryItem,
  RestockRecommendation,
  SimulationState,
  WeeklySchedulerConfig,
} from '@shared/types';
import {
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
  DEFAULT_ACTIVITY_LOG,
} from '@shared/services/defaults';
import { api, PlanRunOverrides } from '../api/client';
import { getFriendlyErrorMessage } from '../lib/errorHelper';

interface CheckoutModalDetails {
  isOpen: boolean;
  strategy?: BasketStrategyResult;
  orderId?: string;
  timestamp?: string;
  itemsPurchased?: BasketItem[];
}

export interface ShopPilotContextType {
  // State
  pantryItems: PantryItem[];
  schedulerConfig: WeeklySchedulerConfig;
  simulationState: SimulationState;
  activeRun: any | null;
  recommendations: RestockRecommendation[];
  optimizationResult: {
    strategies: BasketStrategyResult[];
    recommendedStrategy: BasketStrategyResult;
  } | null;
  selectedStrategyType: BasketStrategyType;
  activityLog: ActivityLogItem[];
  isAnalyzing: boolean;
  isLoading: boolean;
  error: string | null;
  checkoutModal: CheckoutModalDetails;
  showDemoInfoModal: boolean;

  // Actions
  updatePantryItem: (item: PantryItem) => Promise<void>;
  addPantryItem: (item: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>) => Promise<void>;
  deletePantryItem: (id: string) => Promise<void>;
  quickAdjustQuantity: (id: string, delta: number) => Promise<void>;
  updateSchedulerConfig: (config: Partial<WeeklySchedulerConfig>) => Promise<void>;
  advanceTime: (days: number) => Promise<void>;
  runShoppingAnalysis: () => Promise<void>;
  approveRun: () => Promise<void>;
  rejectRun: () => Promise<void>;
  approveRecommendation: (itemId: string) => void;
  rejectRecommendation: (itemId: string) => void;
  includeInWeeklyBasket: (itemId: string) => void;
  includeInUrgentBasket: (itemId: string) => void;
  removeFromBasket: (itemId: string) => void;
  approveAllUrgentItems: () => void;
  setSelectedStrategyType: (type: BasketStrategyType) => void;
  openCheckoutModal: (strategy: BasketStrategyResult) => void;
  closeCheckoutModal: () => void;
  confirmSimulatedPayment: (strategy: BasketStrategyResult) => Promise<void>;
  resetToInitialDemo: () => Promise<void>;
  setShowDemoInfoModal: (show: boolean) => void;
  clearError: () => void;
  reloadState: (overrides?: PlanRunOverrides) => Promise<void>;
}

const ShopPilotContext = createContext<ShopPilotContextType | null>(null);

export const ShopPilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Domain state initialized with sensible defaults while server state loads
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(DEFAULT_PANTRY_ITEMS);
  const [schedulerConfig, setSchedulerConfig] = useState<WeeklySchedulerConfig>(DEFAULT_SCHEDULER_CONFIG);
  const [simulationState, setSimulationState] = useState<SimulationState>(DEFAULT_SIMULATION_STATE);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>(DEFAULT_ACTIVITY_LOG);

  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<{
    strategies: BasketStrategyResult[];
    recommendedStrategy: BasketStrategyResult;
  } | null>(null);

  const [selectedStrategyType, setSelectedStrategyType] = useState<BasketStrategyType>(
    'STRATEGY_B_SINGLE_STORE'
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalDetails>({ isOpen: false });
  const [showDemoInfoModal, setShowDemoInfoModal] = useState(false);

  // In-memory basket toggle overrides (Decision 2: do NOT mutate pantry items)
  const basketOverridesRef = useRef<{ includeItemIds: string[]; excludeItemIds: string[] }>({
    includeItemIds: [],
    excludeItemIds: [],
  });
  const selectedStrategyTypeRef = useRef<BasketStrategyType>('STRATEGY_B_SINGLE_STORE');

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Synchronize all domain state from the server:
   * 1. GET /api/state (pantry, policy, clock, activeRun, recentAuditLog)
   * 2. POST /api/runs/plan (recommendations, all 4 strategies, recommendedStrategy)
   */
  const reloadState = useCallback(async (overrides?: PlanRunOverrides) => {
    try {
      setError(null);
      const effectiveOverrides: PlanRunOverrides = overrides || {
        includeItemIds: basketOverridesRef.current.includeItemIds,
        excludeItemIds: basketOverridesRef.current.excludeItemIds,
        strategy: selectedStrategyTypeRef.current,
      };

      const [stateRes, planRes] = await Promise.all([
        api.getState(),
        api.planRun(effectiveOverrides),
      ]);

      setPantryItems(stateRes.pantry);
      setSchedulerConfig(stateRes.policy);
      setSimulationState(stateRes.clock);
      setActivityLog(stateRes.recentAuditLog);

      setActiveRun(planRes.run);
      setRecommendations(planRes.recommendations);
      setOptimizationResult({
        strategies: planRes.strategies,
        recommendedStrategy: planRes.recommendedStrategy,
      });

      if (planRes.run?.selectedStrategy) {
        setSelectedStrategyType(planRes.run.selectedStrategy);
        selectedStrategyTypeRef.current = planRes.run.selectedStrategy;
      } else if (planRes.recommendedStrategy) {
        setSelectedStrategyType(planRes.recommendedStrategy.type);
        selectedStrategyTypeRef.current = planRes.recommendedStrategy.type;
      }
    } catch (err: any) {
      console.error('Failed to sync state with backend API:', err);
      setError(getFriendlyErrorMessage(err));
    }
  }, []);

  // Debounced auto-plan to prevent race conditions during rapid user adjustments
  const autoPlanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedAutoPlan = useCallback(
    (overrides?: PlanRunOverrides) => {
      if (autoPlanTimerRef.current) {
        clearTimeout(autoPlanTimerRef.current);
      }
      autoPlanTimerRef.current = setTimeout(() => {
        reloadState(overrides);
      }, 300);
    },
    [reloadState]
  );

  // Hydrate state on initial mount
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setIsLoading(true);
      await reloadState();
      if (isMounted) {
        setIsLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
      if (autoPlanTimerRef.current) clearTimeout(autoPlanTimerRef.current);
    };
  }, [reloadState]);

  // Update pantry item via API
  const updatePantryItem = useCallback(
    async (updated: PantryItem) => {
      try {
        await api.updatePantryItem(updated.id, updated);
        await reloadState();
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      }
    },
    [reloadState]
  );

  // Add new pantry item via API
  const addPantryItem = useCallback(
    async (itemData: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>) => {
      try {
        await api.createPantryItem(itemData);
        await reloadState();
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      }
    },
    [reloadState]
  );

  // Delete pantry item via API
  const deletePantryItem = useCallback(
    async (id: string) => {
      try {
        await api.deletePantryItem(id);
        await reloadState();
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      }
    },
    [reloadState]
  );

  // Quick adjust quantity (+/- button) via API
  const quickAdjustQuantity = useCallback(
    async (id: string, delta: number) => {
      try {
        await api.adjustPantryQuantity(id, delta);
        debouncedAutoPlan();
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      }
    },
    [debouncedAutoPlan]
  );

  // Update policy / scheduler configuration via API
  const updateSchedulerConfig = useCallback(
    async (updates: Partial<WeeklySchedulerConfig>) => {
      try {
        await api.updatePolicy(updates);
        await reloadState();
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      }
    },
    [reloadState]
  );

  // Advance simulation time via API
  const advanceTime = useCallback(
    async (days: number) => {
      setIsAnalyzing(true);
      try {
        const validDays = (days === 1 || days === 3 || days === 7 ? days : 1) as 1 | 3 | 7;
        await api.advanceTime(validDays);
        await reloadState();
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      } finally {
        setIsAnalyzing(false);
      }
    },
    [reloadState]
  );

  // Manual trigger for shopping analysis
  const runShoppingAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      await reloadState();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, [reloadState]);

  // Strategy switching (Decision 4: store chosen strategy on run and update totals & policy)
  const handleSetSelectedStrategyType = useCallback(
    async (type: BasketStrategyType) => {
      setSelectedStrategyType(type);
      selectedStrategyTypeRef.current = type;

      if (activeRun?.id) {
        try {
          const res = await api.changeRunStrategy(activeRun.id, type);
          setActiveRun(res.run);
          setRecommendations(res.recommendations);
          setOptimizationResult({
            strategies: res.strategies,
            recommendedStrategy: res.recommendedStrategy,
          });
          const auditRes = await api.getAuditLog();
          setActivityLog(auditRes.logs);
        } catch (err: any) {
          setError(getFriendlyErrorMessage(err));
        }
      } else {
        await reloadState({ ...basketOverridesRef.current, strategy: type });
      }
    },
    [activeRun, reloadState]
  );

  // Run-level approvals (Decision 3: approvals are run-level)
  const approveRun = useCallback(async () => {
    if (!activeRun?.id) return;
    setIsLoading(true);
    try {
      // 1. Immediately mark all recommendations as approved in local state
      setRecommendations(prev =>
        prev.map(r => ({ ...r, requiresApproval: false, approvalStatus: 'approved' as const }))
      );

      // 2. Call backend if run is not yet approved
      if (activeRun.status !== 'approved') {
        const res = await api.approveRun(activeRun.id);
        setActiveRun(res.run);
      } else {
        setActiveRun({ ...activeRun, status: 'approved' });
      }

      const auditRes = await api.getAuditLog();
      setActivityLog(auditRes.logs);
    } catch (err: any) {
      if (
        err?.message?.toLowerCase().includes('already approved') ||
        err?.message?.toLowerCase().includes('cannot be approved from status')
      ) {
        setRecommendations(prev =>
          prev.map(r => ({ ...r, requiresApproval: false, approvalStatus: 'approved' as const }))
        );
        setActiveRun({ ...activeRun, status: 'approved' });
      } else {
        setError(getFriendlyErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeRun]);

  const rejectRun = useCallback(async () => {
    if (!activeRun?.id) return;
    setIsLoading(true);
    try {
      const res = await api.rejectRun(activeRun.id);
      setActiveRun(res.run);
      const auditRes = await api.getAuditLog();
      setActivityLog(auditRes.logs);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeRun]);

  // Basket overrides (Decision 2: do NOT mutate pantry items, pass overrides to plan)
  const includeInWeeklyBasket = useCallback(
    (itemId: string) => {
      const newInclude = Array.from(new Set([...basketOverridesRef.current.includeItemIds, itemId]));
      const newExclude = basketOverridesRef.current.excludeItemIds.filter(id => id !== itemId);
      basketOverridesRef.current = { includeItemIds: newInclude, excludeItemIds: newExclude };
      reloadState({
        includeItemIds: newInclude,
        excludeItemIds: newExclude,
        strategy: selectedStrategyTypeRef.current,
      });
    },
    [reloadState]
  );

  const includeInUrgentBasket = useCallback(
    (itemId: string) => {
      const newInclude = Array.from(new Set([...basketOverridesRef.current.includeItemIds, itemId]));
      const newExclude = basketOverridesRef.current.excludeItemIds.filter(id => id !== itemId);
      basketOverridesRef.current = { includeItemIds: newInclude, excludeItemIds: newExclude };
      reloadState({
        includeItemIds: newInclude,
        excludeItemIds: newExclude,
        strategy: selectedStrategyTypeRef.current,
      });
    },
    [reloadState]
  );

  const removeFromBasket = useCallback(
    (itemId: string) => {
      const newInclude = basketOverridesRef.current.includeItemIds.filter(id => id !== itemId);
      const newExclude = Array.from(new Set([...basketOverridesRef.current.excludeItemIds, itemId]));
      basketOverridesRef.current = { includeItemIds: newInclude, excludeItemIds: newExclude };
      reloadState({
        includeItemIds: newInclude,
        excludeItemIds: newExclude,
        strategy: selectedStrategyTypeRef.current,
      });
    },
    [reloadState]
  );

  const approveRecommendation = useCallback(
    async (itemId: string) => {
      // 1. Update this recommendation to approved
      let hasOtherPending = false;
      setRecommendations(prev => {
        const next = prev.map(r =>
          r.itemId === itemId
            ? { ...r, requiresApproval: false, approvalStatus: 'approved' as const }
            : r
        );
        hasOtherPending = next.some(
          r =>
            r.itemId !== itemId &&
            (r.requiresApproval || r.isSubstitution) &&
            r.approvalStatus !== 'approved' &&
            r.approvalStatus !== 'rejected'
        );
        return next;
      });

      // 2. If no other items need approval, approve the run on backend
      if (!hasOtherPending && activeRun?.id) {
        await approveRun();
      }
    },
    [activeRun, approveRun]
  );

  const rejectRecommendation = useCallback(
    (itemId: string) => {
      setRecommendations(prev =>
        prev.map(r =>
          r.itemId === itemId
            ? { ...r, requiresApproval: false, approvalStatus: 'rejected' as const }
            : r
        )
      );
      removeFromBasket(itemId);
    },
    [removeFromBasket]
  );

  const approveAllUrgentItems = useCallback(() => {
    approveRun();
  }, [approveRun]);

  // Checkout modal controls
  const openCheckoutModal = useCallback((strategy: BasketStrategyResult) => {
    setCheckoutModal({
      isOpen: true,
      strategy,
    });
  }, []);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutModal({ isOpen: false });
  }, []);

  // Confirm Simulated Checkout using Backend Checkout API
  const confirmSimulatedPayment = useCallback(
    async (strategy: BasketStrategyResult) => {
      setIsLoading(true);
      try {
        let runId = activeRun?.id;
        if (!runId) {
          const planRes = await api.planRun({ strategy: strategy.type });
          runId = planRes.run.id;
        }

        const orderRes = await api.createCheckoutOrder(runId);
        await api.captureCheckoutOrder(orderRes.orderId, runId);

        // Refresh state from server to reflect restocked pantry & receipts
        await reloadState();

        const allPurchasedItems = strategy.storeBaskets.flatMap(b => b.items);

        setCheckoutModal({
          isOpen: true,
          strategy,
          orderId: orderRes.orderId,
          timestamp: new Date().toLocaleTimeString(),
          itemsPurchased: allPurchasedItems,
        });
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [activeRun, reloadState]
  );

  // Reset demo via POST /api/state/reset (Decision 1)
  const resetToInitialDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.resetState();
      basketOverridesRef.current = { includeItemIds: [], excludeItemIds: [] };
      await reloadState({ includeItemIds: [], excludeItemIds: [] });
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [reloadState]);

  return (
    <ShopPilotContext.Provider
      value={{
        pantryItems,
        schedulerConfig,
        simulationState,
        activeRun,
        recommendations,
        optimizationResult,
        selectedStrategyType,
        activityLog,
        isAnalyzing,
        isLoading,
        error,
        checkoutModal,
        showDemoInfoModal,
        updatePantryItem,
        addPantryItem,
        deletePantryItem,
        quickAdjustQuantity,
        updateSchedulerConfig,
        advanceTime,
        runShoppingAnalysis,
        approveRun,
        rejectRun,
        approveRecommendation,
        rejectRecommendation,
        includeInWeeklyBasket,
        includeInUrgentBasket,
        removeFromBasket,
        approveAllUrgentItems,
        setSelectedStrategyType: handleSetSelectedStrategyType,
        openCheckoutModal,
        closeCheckoutModal,
        confirmSimulatedPayment,
        resetToInitialDemo,
        setShowDemoInfoModal,
        clearError,
        reloadState,
      }}
    >
      {children}
    </ShopPilotContext.Provider>
  );
};

export const useShopPilot = (): ShopPilotContextType => {
  const context = useContext(ShopPilotContext);
  if (!context) {
    throw new Error('useShopPilot must be used within a ShopPilotProvider');
  }
  return context;
};
