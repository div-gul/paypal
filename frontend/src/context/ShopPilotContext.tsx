import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ActivityLogItem,
  BasketItem,
  BasketStrategyResult,
  BasketStrategyType,
  PantryItem,
  ProductSwapRequest,
  RestockRecommendation,
  SimulationState,
  UpcomingOrderBucket,
  WeeklySchedulerConfig,
} from '@shared/types';
import {
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
  DEFAULT_ACTIVITY_LOG,
} from '@shared/services/defaults';
import {
  computeUpcomingOrderBucket,
  updateOrderItemQuantity,
  removeOrderItem,
  addOrderItem,
  buildStrategyFromUpcomingBucket,
} from '@shared/services/orderBucketService';
import { advancePantryState } from '@shared/services/consumptionEngine';
import { api, PlanRunOverrides } from '../api/client';
import { getFriendlyErrorMessage } from '../lib/errorHelper';

export interface CheckoutModalDetails {
  isOpen: boolean;
  strategy?: BasketStrategyResult;
  orderId?: string;
  captureId?: string;
  usdAmount?: string;
  inrAmount?: number;
  payerEmail?: string;
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

  // Approval & Order Bucket State
  upcomingOrder: UpcomingOrderBucket;
  pendingSwaps: ProductSwapRequest[];
  isUpcomingOrderSaved: boolean;

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
  checkoutStrategy: BasketStrategyResult;
  openCheckoutModal: (strategy?: BasketStrategyResult) => void;
  closeCheckoutModal: () => void;
  confirmSimulatedPayment: (strategy: BasketStrategyResult) => Promise<void>;
  completeCheckout: (details: {
    strategy: BasketStrategyResult;
    orderId: string;
    captureId?: string;
    usdAmount?: string;
    inrAmount?: number;
    payerEmail?: string;
    timestamp?: string;
    itemsPurchased?: BasketItem[];
  }) => Promise<void>;
  resetToInitialDemo: () => Promise<void>;
  setShowDemoInfoModal: (show: boolean) => void;
  clearError: () => void;
  reloadState: (overrides?: PlanRunOverrides) => Promise<void>;

  // Dedicated Order Bucket & Swap Actions (Instant 0ms latency)
  updateOrderItemQty: (itemId: string, delta: number) => void;
  removeOrderItemFromBucket: (itemId: string) => void;
  addOrderItemToBucket: (pantryItemId: string) => void;
  saveUpcomingOrder: () => Promise<void>;
  approveSwap: (pantryItemId: string) => void;
  rejectSwap: (pantryItemId: string) => void;
}

const ShopPilotContext = createContext<ShopPilotContextType | null>(null);

export const ShopPilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Domain state initialized with sensible defaults while server state loads
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(DEFAULT_PANTRY_ITEMS);
  const [schedulerConfig, setSchedulerConfig] = useState<WeeklySchedulerConfig>(DEFAULT_SCHEDULER_CONFIG);
  const [simulationState, setSimulationState] = useState<SimulationState>(DEFAULT_SIMULATION_STATE);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>(DEFAULT_ACTIVITY_LOG);
  const domainStateRef = useRef({ pantryItems, schedulerConfig, simulationState });
  domainStateRef.current = { pantryItems, schedulerConfig, simulationState };
  const planRequestIdRef = useRef(0);

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
  const planRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const policySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPolicyUpdatesRef = useRef<Partial<WeeklySchedulerConfig>>({});
  const policySaveWaitersRef = useRef<Array<() => void>>([]);

  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalDetails>({ isOpen: false });
  const [showDemoInfoModal, setShowDemoInfoModal] = useState(false);

  // In-memory user swap decisions: record of pantryItemId -> 'approved' | 'rejected'
  const swapDecisionsRef = useRef<Record<string, 'approved' | 'rejected'>>({});

  // Consolidated Upcoming Weekly Order Bucket & Pending Product Swaps
  const [upcomingOrder, setUpcomingOrder] = useState<UpcomingOrderBucket>(() => {
    try {
      const saved = localStorage.getItem('shoppilot-upcoming-order');
      if (saved) return JSON.parse(saved) as UpcomingOrderBucket;
    } catch (error) {
      console.warn('Could not restore saved order:', error);
    }
    const res = computeUpcomingOrderBucket({
      pantryItems: DEFAULT_PANTRY_ITEMS,
      schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
      simulationState: DEFAULT_SIMULATION_STATE,
      existingBucket: null,
      swapDecisions: {},
    });
    return res.bucket;
  });

  const [pendingSwaps, setPendingSwaps] = useState<ProductSwapRequest[]>(() => {
    const res = computeUpcomingOrderBucket({
      pantryItems: DEFAULT_PANTRY_ITEMS,
      schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
      simulationState: DEFAULT_SIMULATION_STATE,
      existingBucket: null,
      swapDecisions: {},
    });
    return res.pendingSwaps;
  });

  // In-memory basket toggle overrides
  const basketOverridesRef = useRef<{ includeItemIds: string[]; excludeItemIds: string[] }>({
    includeItemIds: [],
    excludeItemIds: [],
  });
  const selectedStrategyTypeRef = useRef<BasketStrategyType>('STRATEGY_B_SINGLE_STORE');

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const applyDomainSnapshot = useCallback(
    (updates: Partial<typeof domainStateRef.current>) => {
      const next = { ...domainStateRef.current, ...updates };
      domainStateRef.current = next;

      if (updates.pantryItems) setPantryItems(updates.pantryItems);
      if (updates.schedulerConfig) setSchedulerConfig(updates.schedulerConfig);
      if (updates.simulationState) setSimulationState(updates.simulationState);

      setUpcomingOrder(previous => {
        const result = computeUpcomingOrderBucket({
          pantryItems: next.pantryItems,
          schedulerConfig: next.schedulerConfig,
          simulationState: next.simulationState,
          existingBucket: previous,
          swapDecisions: swapDecisionsRef.current,
        });
        setPendingSwaps(result.pendingSwaps);
        return result.bucket;
      });
    },
    []
  );

  const refreshPlan = useCallback(async (overrides?: PlanRunOverrides) => {
    const requestId = ++planRequestIdRef.current;
    const effectiveOverrides = overrides || {
      includeItemIds: basketOverridesRef.current.includeItemIds,
      excludeItemIds: basketOverridesRef.current.excludeItemIds,
      strategy: selectedStrategyTypeRef.current,
    };
    const planRes = await api.planRun(effectiveOverrides);
    if (requestId !== planRequestIdRef.current) return;

    setActiveRun(planRes.run);
    setRecommendations(planRes.recommendations);
    setOptimizationResult({
      strategies: planRes.strategies,
      recommendedStrategy: planRes.recommendedStrategy,
    });

    const strategy = planRes.run?.selectedStrategy || planRes.recommendedStrategy?.type;
    if (strategy) {
      setSelectedStrategyType(strategy);
      selectedStrategyTypeRef.current = strategy;
    }
  }, []);

  const schedulePlanRefresh = useCallback(() => {
    if (planRefreshTimerRef.current) clearTimeout(planRefreshTimerRef.current);
    planRefreshTimerRef.current = setTimeout(() => {
      void refreshPlan().catch(err => setError(getFriendlyErrorMessage(err)));
    }, 250);
  }, [refreshPlan]);

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

      applyDomainSnapshot({
        pantryItems: stateRes.pantry,
        schedulerConfig: stateRes.policy,
        simulationState: stateRes.clock,
      });
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
      // Fallback: update local bucket even if offline
      setUpcomingOrder(prev => {
        const current = domainStateRef.current;
        const res = computeUpcomingOrderBucket({
          pantryItems: current.pantryItems,
          schedulerConfig: current.schedulerConfig,
          simulationState: current.simulationState,
          existingBucket: prev,
          swapDecisions: swapDecisionsRef.current,
        });
        setPendingSwaps(res.pendingSwaps);
        return { ...res.bucket, savedAt: undefined };
      });
      setError(getFriendlyErrorMessage(err));
    }
  }, [applyDomainSnapshot]);

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
    };
  }, [reloadState]);

  // Update pantry item via API
  const updatePantryItem = useCallback(
    async (updated: PantryItem) => {
      const previous = domainStateRef.current.pantryItems;
      applyDomainSnapshot({
        pantryItems: previous.map(item => item.id === updated.id ? updated : item),
      });
      try {
        const { item } = await api.updatePantryItem(updated.id, updated);
        const current = domainStateRef.current.pantryItems;
        applyDomainSnapshot({ pantryItems: current.map(row => row.id === item.id ? item : row) });
        schedulePlanRefresh();
      } catch (err: any) {
        const current = domainStateRef.current.pantryItems;
        applyDomainSnapshot({
          pantryItems: current.map(item => item.id === updated.id
            ? previous.find(old => old.id === updated.id) || item
            : item),
        });
        setError(getFriendlyErrorMessage(err));
      }
    },
    [applyDomainSnapshot, schedulePlanRefresh]
  );

  // Add new pantry item via API
  const addPantryItem = useCallback(
    async (itemData: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>) => {
      const temporaryId = `pending-${Date.now()}`;
      const optimisticItem: PantryItem = {
        ...itemData,
        id: temporaryId,
        lastRestockedDate: new Date().toISOString(),
        stockoutDaysCount: 0,
      };
      applyDomainSnapshot({ pantryItems: [...domainStateRef.current.pantryItems, optimisticItem] });
      try {
        const { item } = await api.createPantryItem(itemData);
        applyDomainSnapshot({
          pantryItems: domainStateRef.current.pantryItems.map(row => row.id === temporaryId ? item : row),
        });
        schedulePlanRefresh();
      } catch (err: any) {
        applyDomainSnapshot({
          pantryItems: domainStateRef.current.pantryItems.filter(row => row.id !== temporaryId),
        });
        setError(getFriendlyErrorMessage(err));
      }
    },
    [applyDomainSnapshot, schedulePlanRefresh]
  );

  // Delete pantry item via API
  const deletePantryItem = useCallback(
    async (id: string) => {
      const previous = domainStateRef.current.pantryItems;
      applyDomainSnapshot({ pantryItems: previous.filter(item => item.id !== id) });
      try {
        await api.deletePantryItem(id);
        schedulePlanRefresh();
      } catch (err: any) {
        const current = domainStateRef.current.pantryItems;
        const deletedItem = previous.find(item => item.id === id);
        if (deletedItem) applyDomainSnapshot({ pantryItems: [...current, deletedItem] });
        setError(getFriendlyErrorMessage(err));
      }
    },
    [applyDomainSnapshot, schedulePlanRefresh]
  );

  /**
   * CRITICAL FIX: Quick adjust quantity (+/- button)
   * Pure instantaneous React state update with ZERO artificial lag or debounce delay!
   * The displayed quantity, line subtotal, and upcoming order bucket update IMMEDIATELY.
   * Persistence to backend occurs concurrently in the background.
   */
  const quickAdjustQuantity = useCallback(
    async (id: string, delta: number) => {
      const current = domainStateRef.current.pantryItems;
      const updatedPantry = current.map(item => {
        if (item.id !== id) return item;
        const rawNew = Math.max(0, item.currentQuantity + delta);
        const newQty = item.allowFractions
          ? Math.round(rawNew * 100) / 100
          : Math.round(rawNew);
        return { ...item, currentQuantity: newQty };
      });
      applyDomainSnapshot({ pantryItems: updatedPantry });

      // Persist in the background; the displayed quantity and order update immediately.
      try {
        api.adjustPantryQuantity(id, delta).catch(err => {
          console.warn('Background pantry persistence notice:', err);
        });
      } catch (err: any) {
        console.warn('Background pantry sync error:', err);
      }
    },
    [applyDomainSnapshot]
  );

  // Update policy / scheduler configuration via API
  const updateSchedulerConfig = useCallback(
    (updates: Partial<WeeklySchedulerConfig>) => {
      applyDomainSnapshot({
        schedulerConfig: { ...domainStateRef.current.schedulerConfig, ...updates },
      });
      pendingPolicyUpdatesRef.current = { ...pendingPolicyUpdatesRef.current, ...updates };

      const saved = new Promise<void>(resolve => {
        policySaveWaitersRef.current.push(resolve);
      });

      if (policySaveTimerRef.current) clearTimeout(policySaveTimerRef.current);
      policySaveTimerRef.current = setTimeout(async () => {
        const queuedUpdates = pendingPolicyUpdatesRef.current;
        pendingPolicyUpdatesRef.current = {};
        const waiters = policySaveWaitersRef.current.splice(0);

        try {
          await api.updatePolicy(queuedUpdates);
          schedulePlanRefresh();
        } catch (err: any) {
          setError(getFriendlyErrorMessage(err));
          try {
            const { policy } = await api.getPolicy();
            applyDomainSnapshot({
              schedulerConfig: { ...policy, ...pendingPolicyUpdatesRef.current },
            });
          } catch {
            // Keep the optimistic values visible if the backend is unavailable.
          }
        } finally {
          waiters.forEach(resolve => resolve());
        }
      }, 200);

      return saved;
    },
    [applyDomainSnapshot, schedulePlanRefresh]
  );

  /**
   * ADVANCE SIMULATION TIME
   * Requirement 2: Future simulation updates the next order bucket immediately.
   * Recalculates depletion, adds newly required products directly to the upcoming order bucket,
   * updates quantities, recalculates order total, and preserves user modifications.
   * Manual order edits reset at cycle rollover; swap decisions remain in effect.
   */
  const advanceTime = useCallback(
    async (days: number) => {
      setIsAnalyzing(true);
      try {
        const validDays = (days === 1 || days === 3 || days === 7 ? days : 1) as 1 | 3 | 7;

        // 1. Immediately compute advanced clock & depleted pantry stock
        const currentSimDateMs = new Date(simulationState.simulatedDate).getTime();
        const nextSimDate = new Date(currentSimDateMs + validDays * 86400000).toISOString();
        let nextShoppingDate = new Date(schedulerConfig.nextShoppingDate);
        const nextSimDateMs = new Date(nextSimDate).getTime();
        const intervalDays = schedulerConfig.shoppingFrequency === 'biweekly' ? 14 : 7;
        let cyclesAdvanced = 0;
        while (nextShoppingDate.getTime() <= nextSimDateMs) {
          nextShoppingDate.setDate(nextShoppingDate.getDate() + intervalDays);
          cyclesAdvanced += 1;
        }
        const cycleChanged = cyclesAdvanced > 0;
        const nextSchedulerConfig = cycleChanged
          ? { ...schedulerConfig, nextShoppingDate: nextShoppingDate.toISOString() }
          : schedulerConfig;
        const nextClock: SimulationState = {
          ...simulationState,
          daysElapsed: simulationState.daysElapsed + validDays,
          simulatedDate: nextSimDate,
          cycleCount: simulationState.cycleCount + cyclesAdvanced,
        };
        const depletedPantry = advancePantryState(pantryItems, validDays);

        setSimulationState(nextClock);
        setPantryItems(depletedPantry);
        let scheduleSync: Promise<unknown> = Promise.resolve();
        if (cycleChanged) {
          domainStateRef.current = { ...domainStateRef.current, schedulerConfig: nextSchedulerConfig };
          setSchedulerConfig(nextSchedulerConfig);
          try {
            localStorage.removeItem('shoppilot-upcoming-order');
          } catch {
            // Keep simulation progress even if browser storage is unavailable.
          }
          scheduleSync = api.updatePolicy({ nextShoppingDate: nextSchedulerConfig.nextShoppingDate });
        }

        // 2. Immediately update the upcoming order bucket
        setUpcomingOrder(prev => {
          const res = computeUpcomingOrderBucket({
            pantryItems: depletedPantry,
            schedulerConfig: nextSchedulerConfig,
            simulationState: nextClock,
            // Order edits belong to one cycle; swap decisions remain available to the next.
            existingBucket: cycleChanged ? null : prev,
            swapDecisions: swapDecisionsRef.current,
          });
          setPendingSwaps(res.pendingSwaps);
          return res.bucket;
        });

        // 3. Asynchronously sync with backend API
        await api.advanceTime(validDays).catch(err => {
          console.warn('Background time advance sync notice:', err);
        });
        await scheduleSync.catch(err => {
          console.warn('Next cycle schedule sync notice:', err);
        });
        await refreshPlan().catch(err => {
          console.warn('Future simulation planning notice:', err);
        });
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
      } finally {
        setIsAnalyzing(false);
      }
    },
    [pantryItems, schedulerConfig, simulationState, refreshPlan]
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

  // Strategy switching
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

  // Run-level approvals
  const approveRun = useCallback(async () => {
    if (!activeRun?.id) return;
    setIsLoading(true);
    try {
      setRecommendations(prev =>
        prev.map(r => ({ ...r, requiresApproval: false, approvalStatus: 'approved' as const }))
      );

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

  // Basket overrides
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
      setRecommendations(prev =>
        prev.map(r =>
          r.itemId === itemId
            ? { ...r, requiresApproval: false, approvalStatus: 'approved' as const }
            : r
        )
      );
      if (activeRun?.id) {
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

  // Guaranteed robust checkout strategy synthesized from upcomingOrder + optimizer
  const checkoutStrategy = useMemo(() => {
    return buildStrategyFromUpcomingBucket(
      upcomingOrder,
      optimizationResult?.recommendedStrategy || optimizationResult?.strategies?.[0]
    );
  }, [upcomingOrder, optimizationResult]);

  // Checkout modal controls
  const openCheckoutModal = useCallback((strategy?: BasketStrategyResult) => {
    const effectiveStrategy =
      strategy && Array.isArray(strategy.storeBaskets) && strategy.storeBaskets.length > 0
        ? strategy
        : buildStrategyFromUpcomingBucket(
            upcomingOrder,
            optimizationResult?.recommendedStrategy || optimizationResult?.strategies?.[0]
          );

    setCheckoutModal({
      isOpen: true,
      strategy: effectiveStrategy,
    });
  }, [upcomingOrder, optimizationResult]);

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

        // Ensure run is approved before creating checkout order
        try {
          const approveRes = await api.approveRun(runId);
          if (approveRes?.run) {
            runId = approveRes.run.id;
            setActiveRun(approveRes.run);
          }
        } catch (e: any) {
          console.info('Run approval check before checkout order:', e?.message || e);
        }

        const orderRes = await api.createCheckoutOrder(runId);
        const captureRes = await api.captureCheckoutOrder(orderRes.orderId, runId);

        await reloadState();

        const allPurchasedItems = strategy.storeBaskets.flatMap(b => b.items);

        setCheckoutModal({
          isOpen: true,
          strategy,
          orderId: orderRes.orderId,
          captureId: captureRes.receipt?.paypalCaptureId || captureRes.receipt?.id,
          usdAmount: captureRes.receipt?.usdAmount,
          inrAmount: captureRes.receipt?.amountPaise || strategy.grandTotalPaise,
          payerEmail: captureRes.receipt?.payerEmail,
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

  const completeCheckout = useCallback(
    async (details: {
      strategy: BasketStrategyResult;
      orderId: string;
      captureId?: string;
      usdAmount?: string;
      inrAmount?: number;
      payerEmail?: string;
      timestamp?: string;
      itemsPurchased?: BasketItem[];
    }) => {
      await reloadState();
      const allPurchasedItems = details.itemsPurchased || details.strategy.storeBaskets.flatMap(b => b.items);
      setCheckoutModal({
        isOpen: true,
        strategy: details.strategy,
        orderId: details.orderId,
        captureId: details.captureId,
        usdAmount: details.usdAmount,
        inrAmount: details.inrAmount || details.strategy.grandTotalPaise,
        payerEmail: details.payerEmail,
        timestamp: details.timestamp || new Date().toLocaleTimeString(),
        itemsPurchased: allPurchasedItems,
      });
    },
    [reloadState]
  );

  // Reset demo
  const resetToInitialDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      swapDecisionsRef.current = {};
      try {
        localStorage.removeItem('shoppilot-upcoming-order');
      } catch {
        // Reset in-memory state even when browser storage is unavailable.
      }
      const res = computeUpcomingOrderBucket({
        pantryItems: DEFAULT_PANTRY_ITEMS,
        schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
        simulationState: DEFAULT_SIMULATION_STATE,
        existingBucket: null,
        swapDecisions: {},
      });
      setUpcomingOrder(res.bucket);
      setPendingSwaps(res.pendingSwaps);
      setPantryItems(DEFAULT_PANTRY_ITEMS);
      setSimulationState(DEFAULT_SIMULATION_STATE);

      await api.resetState().catch(e => console.warn('Reset backend notice:', e));
      basketOverridesRef.current = { includeItemIds: [], excludeItemIds: [] };
      await reloadState({ includeItemIds: [], excludeItemIds: [] });
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [reloadState]);

  // -------------------------------------------------------------
  // DEDICATED UPCOMING ORDER BUCKET ACTIONS (Instantaneous 0ms)
  // -------------------------------------------------------------

  /**
   * Instantly update quantity of an item in the upcoming order bucket.
   * Functional state update ensures zero lag and immediate total calculation.
   */
  const updateOrderItemQty = useCallback((itemId: string, delta: number) => {
    setUpcomingOrder(prev => {
      const updated = updateOrderItemQuantity(prev, itemId, delta);
      return { ...updated, savedAt: undefined };
    });
  }, []);

  /**
   * Instantly remove an item from the upcoming order bucket.
   */
  const removeOrderItemFromBucket = useCallback((itemId: string) => {
      setUpcomingOrder(prev => {
        const updated = removeOrderItem(prev, itemId);
        return { ...updated, savedAt: undefined };
    });
  }, []);

  /**
   * Instantly add a pantry item into the upcoming order bucket.
   */
  const addOrderItemToBucket = useCallback(
    (pantryItemId: string) => {
      const pantryItem = pantryItems.find(p => p.id === pantryItemId);
      if (!pantryItem) return;
      setUpcomingOrder(prev => {
        const updated = addOrderItem(prev, pantryItem);
        return { ...updated, savedAt: undefined };
      });
    },
    [pantryItems]
  );

  /**
   * Approve the complete upcoming weekly order (One consolidated approval).
   * Saves the editable order draft for Home and future visits.
   */
  const saveUpcomingOrder = useCallback(async () => {
    setUpcomingOrder(prev => {
      const saved = { ...prev, status: 'draft' as const, approvedAt: undefined, savedAt: new Date().toISOString() };
      try {
        localStorage.setItem('shoppilot-upcoming-order', JSON.stringify(saved));
      } catch (error) {
        console.warn('Could not save order:', error);
      }
      return saved;
    });
    if (activeRun?.id) {
      try {
        const result = await api.approveRun(activeRun.id);
        setActiveRun(result.run);
      } catch (err: any) {
        const message = String(err?.message || '').toLowerCase();
        if (message.includes('already approved') || message.includes('cannot be approved from status')) {
          setActiveRun((run: any) => run ? { ...run, status: 'approved' } : run);
        } else {
          console.warn('Saved order locally; backend approval sync notice:', err);
        }
      }
    }
  }, [activeRun]);

  /**
   * Approve a product substitution / swap request.
   * Applies the replacement product to the upcoming order item.
   */
  const approveSwap = useCallback(
    (pantryItemId: string) => {
      swapDecisionsRef.current = { ...swapDecisionsRef.current, [pantryItemId]: 'approved' };
      setUpcomingOrder(prev => {
        const res = computeUpcomingOrderBucket({
          pantryItems,
          schedulerConfig,
          simulationState,
          existingBucket: prev,
          swapDecisions: swapDecisionsRef.current,
        });
        setPendingSwaps(res.pendingSwaps);
        const allResolved = res.pendingSwaps.length === 0;
        const savedAt = allResolved ? (prev?.savedAt || new Date().toISOString()) : prev?.savedAt;
        const nextBucket = { ...res.bucket, savedAt };
        if (allResolved) {
          try {
            localStorage.setItem('shoppilot-upcoming-order', JSON.stringify(nextBucket));
          } catch {
            // ignore
          }
        }
        return nextBucket;
      });

      // Synchronize recommendation status so checkout does not block
      setRecommendations(prev =>
        prev.map(r =>
          r.itemId === pantryItemId
            ? { ...r, requiresApproval: false, approvalStatus: 'approved' as const }
            : r
        )
      );

      // If activeRun exists and all swaps are resolved, sync run approval
      if (activeRun?.id) {
        api.approveRun(activeRun.id).then(res => {
          setActiveRun(res.run);
        }).catch(err => {
          const message = String(err?.message || '').toLowerCase();
          if (message.includes('already approved') || message.includes('cannot be approved from status')) {
            setActiveRun((run: any) => run ? { ...run, status: 'approved' } : run);
          }
        });
      }
    },
    [pantryItems, schedulerConfig, simulationState, activeRun]
  );

  /**
   * Reject a product substitution / swap request.
   * Retains the original product in the shopping plan.
   */
  const rejectSwap = useCallback(
    (pantryItemId: string) => {
      swapDecisionsRef.current = { ...swapDecisionsRef.current, [pantryItemId]: 'rejected' };
      setUpcomingOrder(prev => {
        const res = computeUpcomingOrderBucket({
          pantryItems,
          schedulerConfig,
          simulationState,
          existingBucket: prev,
          swapDecisions: swapDecisionsRef.current,
        });
        setPendingSwaps(res.pendingSwaps);
        const allResolved = res.pendingSwaps.length === 0;
        const savedAt = allResolved ? (prev?.savedAt || new Date().toISOString()) : prev?.savedAt;
        const nextBucket = { ...res.bucket, savedAt };
        if (allResolved) {
          try {
            localStorage.setItem('shoppilot-upcoming-order', JSON.stringify(nextBucket));
          } catch {
            // ignore
          }
        }
        return nextBucket;
      });

      setRecommendations(prev =>
        prev.map(r =>
          r.itemId === pantryItemId
            ? { ...r, requiresApproval: false, approvalStatus: 'rejected' as const }
            : r
        )
      );
    },
    [pantryItems, schedulerConfig, simulationState]
  );

  const isUpcomingOrderSaved = Boolean(upcomingOrder?.savedAt) || pendingSwaps.length === 0;

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
        checkoutStrategy,
        activityLog,
        isAnalyzing,
        isLoading,
        error,
        checkoutModal,
        showDemoInfoModal,
        upcomingOrder,
        pendingSwaps,
        isUpcomingOrderSaved,
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
        completeCheckout,
        resetToInitialDemo,
        setShowDemoInfoModal,
        clearError,
        reloadState,
        updateOrderItemQty,
        removeOrderItemFromBucket,
        addOrderItemToBucket,
        saveUpcomingOrder,
        approveSwap,
        rejectSwap,
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
