import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
} from '@shared/services/defaults';
import {
  computeUpcomingOrderBucket,
  updateOrderItemQuantity,
  removeOrderItem,
  addOrderItem,
  getUnpaidOrderItems,
  getSwapDecisionKey,
} from '@shared/services/orderBucketService';
import { advancePantryState } from '@shared/services/consumptionEngine';
import { api, PlanRunOverrides } from '../api/client';
import { getFriendlyErrorMessage } from '../lib/errorHelper';

interface CheckoutModalDetails {
  isOpen: boolean;
  runId?: string;
  strategy?: BasketStrategyResult;
  orderId?: string;
  approvalUrl?: string;
  paymentState?: 'PENDING' | 'APPROVED' | 'CAPTURED' | 'FAILED' | 'CANCELLED';
  currency?: string;
  chargedAmount?: string;
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
  openCheckoutModal: (strategy: BasketStrategyResult, runId?: string) => void;
  prepareUpcomingOrderCheckout: () => Promise<void>;
  closeCheckoutModal: () => void;
  createPayPalOrder: (runId: string, strategy: BasketStrategyResult) => Promise<Awaited<ReturnType<typeof api.createCheckoutOrder>>>;
  capturePayPalOrder: (orderId: string, runId: string, strategy: BasketStrategyResult) => Promise<void>;
  getCheckoutStatus: (runId: string, strategy: BasketStrategyResult) => Promise<Awaited<ReturnType<typeof api.getCheckoutStatus>>>;
  cancelPayPalOrder: (runId: string, orderId?: string) => Promise<void>;
  confirmMockPayment: (strategy: BasketStrategyResult) => Promise<void>;
  resetToInitialDemo: () => Promise<void>;
  setShowDemoInfoModal: (show: boolean) => void;
  clearError: () => void;
  reloadState: (overrides?: PlanRunOverrides) => Promise<void>;

  // Dedicated Order Bucket & Swap Actions (Instant 0ms latency)
  updateOrderItemQty: (itemId: string, delta: number) => void;
  removeOrderItemFromBucket: (itemId: string) => void;
  addOrderItemToBucket: (pantryItemId: string) => void;
  addNewPantryItemToOrder: (item: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>) => Promise<void>;
  saveUpcomingOrder: () => Promise<void>;
  approveSwap: (pantryItemId: string) => void;
  rejectSwap: (pantryItemId: string) => void;
}

const ShopPilotContext = createContext<ShopPilotContextType | null>(null);

export const ShopPilotProvider: React.FC<{ children: React.ReactNode; userRole?: 'user' | 'guest' }> = ({ children, userRole: _userRole }) => {
  // Domain state initialized with sensible defaults while server state loads
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [schedulerConfig, setSchedulerConfig] = useState<WeeklySchedulerConfig>(DEFAULT_SCHEDULER_CONFIG);
  const [simulationState, setSimulationState] = useState<SimulationState>(DEFAULT_SIMULATION_STATE);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
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
  const [upcomingOrder, setUpcomingOrder] = useState<UpcomingOrderBucket>(() => computeUpcomingOrderBucket({
    pantryItems: [], schedulerConfig: DEFAULT_SCHEDULER_CONFIG,
    simulationState: DEFAULT_SIMULATION_STATE, existingBucket: null, swapDecisions: {},
  }).bucket);

  const [pendingSwaps, setPendingSwaps] = useState<ProductSwapRequest[]>(() => {
    const res = computeUpcomingOrderBucket({
      pantryItems: [],
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
  const upcomingCheckoutRunIdRef = useRef<string | null>(null);

  const markUpcomingOrderPaid = useCallback(async () => {
    const paid = {
      ...upcomingOrder,
      status: 'approved' as const,
      savedAt: upcomingOrder.savedAt || new Date().toISOString(),
      paidAt: new Date().toISOString(),
      paidQuantities: Object.fromEntries(upcomingOrder.items.map(item => [item.pantryItemId, item.quantity])),
    };
    setUpcomingOrder(paid);
    setPendingSwaps([]);
    await api.saveWorkspace({ upcomingOrder: paid });
  }, [upcomingOrder]);

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

      const stateRes = await api.getState();
      const [planRes, workspaceRes] = await Promise.all([
        stateRes.pantry.length > 0 ? api.planRun(effectiveOverrides) : Promise.resolve(null),
        api.getWorkspace(),
      ]);

      swapDecisionsRef.current = workspaceRes.swapDecisions || {};

      applyDomainSnapshot({
        pantryItems: stateRes.pantry,
        schedulerConfig: stateRes.policy,
        simulationState: stateRes.clock,
      });
      setActivityLog(stateRes.recentAuditLog);
      if (workspaceRes.upcomingOrder) {
        const refreshedOrder = computeUpcomingOrderBucket({
          pantryItems: stateRes.pantry,
          schedulerConfig: stateRes.policy,
          simulationState: stateRes.clock,
          existingBucket: workspaceRes.upcomingOrder,
          swapDecisions: swapDecisionsRef.current,
        });
        setUpcomingOrder(refreshedOrder.bucket);
        setPendingSwaps(workspaceRes.upcomingOrder.paidAt ? [] : refreshedOrder.pendingSwaps);
      }

      if (planRes) {
        setActiveRun(planRes.run);
        setRecommendations(planRes.recommendations);
        setOptimizationResult({ strategies: planRes.strategies, recommendedStrategy: planRes.recommendedStrategy });
        if (planRes.run?.selectedStrategy) {
          setSelectedStrategyType(planRes.run.selectedStrategy);
          selectedStrategyTypeRef.current = planRes.run.selectedStrategy;
        } else if (planRes.recommendedStrategy) {
          setSelectedStrategyType(planRes.recommendedStrategy.type);
          selectedStrategyTypeRef.current = planRes.recommendedStrategy.type;
        }
      } else {
        setActiveRun(null);
        setRecommendations([]);
        setOptimizationResult(null);
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
          void api.saveWorkspace({ upcomingOrder: null, swapDecisions: swapDecisionsRef.current });
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

  // Checkout modal controls
  const openCheckoutModal = useCallback((strategy: BasketStrategyResult, runId = activeRun?.id) => {
    setCheckoutModal({
      isOpen: true,
      runId,
      strategy,
    });
  }, [activeRun]);

  const prepareUpcomingOrderCheckout = useCallback(async () => {
    const items = getUnpaidOrderItems(upcomingOrder);
    if (items.length === 0) {
      setError(upcomingOrder.paidAt ? 'This upcoming order is already paid. Add more items or increase a quantity to make an additional payment.' : 'There are no items in the saved order to purchase. Add an item before checkout.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { run } = await api.createOrderRun(items);
      upcomingCheckoutRunIdRef.current = run.id;
      if (!run.selectedStrategyDetails) throw new Error('The server did not return the saved order details.');
      setActiveRun(run);
      setCheckoutModal({ isOpen: true, runId: run.id, strategy: run.selectedStrategyDetails });
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [upcomingOrder]);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutModal({ isOpen: false });
  }, []);

  const createPayPalOrder = useCallback(async (runId: string, strategy: BasketStrategyResult) => {
    const result = await api.createCheckoutOrder(runId);
    const serverStrategy = result.run.selectedStrategyDetails || strategy;
    setCheckoutModal(previous => ({
      ...previous,
      isOpen: true,
      runId,
      // Render the persisted run that the backend actually charged, so a stale
      // client strategy cannot show a different item count or total.
      strategy: serverStrategy,
      orderId: result.orderId,
      approvalUrl: result.approvalUrl,
      paymentState: result.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      currency: result.currency,
      chargedAmount: result.chargedAmount,
    }));
    return result;
  }, []);

  const capturePayPalOrder = useCallback(
    async (orderId: string, runId: string, strategy: BasketStrategyResult) => {
      await api.captureCheckoutOrder(orderId);
      setCheckoutModal(previous => ({
        ...previous,
        isOpen: true,
        runId,
        strategy,
        orderId,
        paymentState: 'CAPTURED',
        timestamp: new Date().toLocaleTimeString(),
        itemsPurchased: strategy.storeBaskets.flatMap(basket => basket.items),
      }));
      upcomingCheckoutRunIdRef.current = null;
      await markUpcomingOrderPaid();
      await reloadState().catch(err => console.warn('Payment captured; state refresh notice:', err));
    },
    [markUpcomingOrderPaid, reloadState]
  );

  const getCheckoutStatus = useCallback(
    async (runId: string, strategy: BasketStrategyResult) => {
      const status = await api.getCheckoutStatus(runId);
      setCheckoutModal(previous => ({
        ...previous,
        isOpen: true,
        runId,
        strategy,
        orderId: status.orderId || previous.orderId,
        approvalUrl: status.approvalUrl || previous.approvalUrl,
        paymentState: status.paymentState,
        currency: status.currency || previous.currency,
        chargedAmount: status.chargedAmount || previous.chargedAmount,
        ...(status.paymentState === 'CAPTURED' ? {
          timestamp: previous.timestamp || new Date().toLocaleTimeString(),
          itemsPurchased: strategy.storeBaskets.flatMap(basket => basket.items),
        } : {}),
      }));
      if (status.paymentState === 'CAPTURED') {
        upcomingCheckoutRunIdRef.current = null;
        await markUpcomingOrderPaid();
        await reloadState().catch(err => console.warn('Payment status confirmed; state refresh notice:', err));
      }
      return status;
    },
    [markUpcomingOrderPaid, reloadState]
  );

  const cancelPayPalOrder = useCallback(async (runId: string, orderId?: string) => {
    const result = await api.cancelCheckoutOrder(runId, orderId);
    setCheckoutModal(previous => ({
      ...previous,
      paymentState: result.paymentState as CheckoutModalDetails['paymentState'],
    }));
  }, []);

  // Explicit mock-only checkout for local development when PAYPAL_MODE=mock.
  const confirmMockPayment = useCallback(
    async (strategy: BasketStrategyResult) => {
      setIsLoading(true);
      try {
        let runId = activeRun?.id;
        if (!runId) {
          const planRes = await api.planRun({ strategy: strategy.type });
          runId = planRes.run.id;
        }

        const orderRes = await api.createCheckoutOrder(runId);
        await api.captureCheckoutOrder(orderRes.orderId);

        upcomingCheckoutRunIdRef.current = null;
        await markUpcomingOrderPaid();
        await reloadState();

        const allPurchasedItems = strategy.storeBaskets.flatMap(b => b.items);

        setCheckoutModal({
          isOpen: true,
          strategy,
          orderId: orderRes.orderId,
          paymentState: 'CAPTURED',
          currency: orderRes.currency,
          chargedAmount: orderRes.chargedAmount,
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

  // Reset demo
  const resetToInitialDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      swapDecisionsRef.current = {};
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
        const result = computeUpcomingOrderBucket({
          pantryItems: [pantryItem],
          schedulerConfig,
          simulationState,
          existingBucket: { ...updated, items: updated.items.filter(item => item.pantryItemId === pantryItem.id) },
          swapDecisions: swapDecisionsRef.current,
        });
        const resolved = result.bucket.items[0];
        const items = resolved
          ? updated.items.map(item => item.pantryItemId === pantryItem.id ? resolved : item)
          : updated.items;
        const subtotalPaise = items.reduce((sum, item) => sum + item.totalPricePaise, 0);
        const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
        setPendingSwaps(previous => [
          ...previous.filter(swap => swap.pantryItemId !== pantryItem.id),
          ...result.pendingSwaps,
        ]);
        return { ...updated, items, subtotalPaise, deliveryFeePaise, totalPaise: subtotalPaise + deliveryFeePaise, status: 'draft', savedAt: undefined };
      });
    },
    [pantryItems, schedulerConfig, simulationState]
  );

  const addNewPantryItemToOrder = useCallback(async (
    itemData: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>,
  ) => {
    try {
      const { item } = await api.createPantryItem(itemData);
      const nextPantryItems = [...domainStateRef.current.pantryItems, item];
      domainStateRef.current = { ...domainStateRef.current, pantryItems: nextPantryItems };
      setPantryItems(nextPantryItems);
      setUpcomingOrder(previous => {
        const updated = addOrderItem(previous, item);
        const result = computeUpcomingOrderBucket({
          pantryItems: [item],
          schedulerConfig: domainStateRef.current.schedulerConfig,
          simulationState: domainStateRef.current.simulationState,
          existingBucket: { ...updated, items: updated.items.filter(orderItem => orderItem.pantryItemId === item.id) },
          swapDecisions: swapDecisionsRef.current,
        });
        const resolved = result.bucket.items[0];
        const items = resolved
          ? updated.items.map(orderItem => orderItem.pantryItemId === item.id ? resolved : orderItem)
          : updated.items;
        const subtotalPaise = items.reduce((sum, orderItem) => sum + orderItem.totalPricePaise, 0);
        const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= 39900 ? 0 : 2000;
        setPendingSwaps(previous => [
          ...previous.filter(swap => swap.pantryItemId !== item.id),
          ...result.pendingSwaps,
        ]);
        return { ...updated, items, subtotalPaise, deliveryFeePaise, totalPaise: subtotalPaise + deliveryFeePaise, status: 'draft', savedAt: undefined };
      });
      schedulePlanRefresh();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
      throw err;
    }
  }, [schedulePlanRefresh]);

  /**
   * Approve the complete upcoming weekly order (One consolidated approval).
   * Saves the editable order draft for Home and future visits.
   */
  const saveUpcomingOrder = useCallback(async () => {
    const savedOrder = { ...upcomingOrder, status: 'approved' as const, approvedAt: undefined, savedAt: new Date().toISOString() };
    setUpcomingOrder(savedOrder);
    await api.saveWorkspace({ upcomingOrder: savedOrder }).catch(err => setError(getFriendlyErrorMessage(err)));
  }, [upcomingOrder]);

  /**
   * Approve a product substitution / swap request.
   * Applies the replacement product to the upcoming order item.
   */
  const approveSwap = useCallback(
    (pantryItemId: string) => {
      const pantryItem = pantryItems.find(item => item.id === pantryItemId);
      const swap = pendingSwaps.find(item => item.pantryItemId === pantryItemId);
      if (!pantryItem || !swap) return;
      const key = getSwapDecisionKey(pantryItemId, pantryItem.preferredBrand, swap.replacementProduct.brand);
      swapDecisionsRef.current = { ...swapDecisionsRef.current, [key]: 'approved' };
      void api.saveWorkspace({ swapDecisions: swapDecisionsRef.current }).catch(err => setError(getFriendlyErrorMessage(err)));
      setUpcomingOrder(prev => {
        const res = computeUpcomingOrderBucket({
          pantryItems,
          schedulerConfig,
          simulationState,
          existingBucket: prev,
          swapDecisions: swapDecisionsRef.current,
        });
        setPendingSwaps(res.pendingSwaps);
        return { ...res.bucket, savedAt: undefined };
      });
    },
    [pantryItems, pendingSwaps, schedulerConfig, simulationState]
  );

  /**
   * Reject a product substitution / swap request.
   * Retains the original product in the shopping plan.
   */
  const rejectSwap = useCallback(
    (pantryItemId: string) => {
      const pantryItem = pantryItems.find(item => item.id === pantryItemId);
      const swap = pendingSwaps.find(item => item.pantryItemId === pantryItemId);
      if (!pantryItem || !swap) return;
      const key = getSwapDecisionKey(pantryItemId, pantryItem.preferredBrand, swap.replacementProduct.brand);
      swapDecisionsRef.current = { ...swapDecisionsRef.current, [key]: 'rejected' };
      void api.saveWorkspace({ swapDecisions: swapDecisionsRef.current }).catch(err => setError(getFriendlyErrorMessage(err)));
      setUpcomingOrder(prev => {
        const res = computeUpcomingOrderBucket({
          pantryItems,
          schedulerConfig,
          simulationState,
          existingBucket: prev,
          swapDecisions: swapDecisionsRef.current,
        });
        setPendingSwaps(res.pendingSwaps);
        return { ...res.bucket, savedAt: undefined };
      });
    },
    [pantryItems, pendingSwaps, schedulerConfig, simulationState]
  );

  const isUpcomingOrderSaved = Boolean(upcomingOrder?.savedAt);

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
        prepareUpcomingOrderCheckout,
        closeCheckoutModal,
        createPayPalOrder,
        capturePayPalOrder,
        getCheckoutStatus,
        cancelPayPalOrder,
        confirmMockPayment,
        resetToInitialDemo,
        setShowDemoInfoModal,
        clearError,
        reloadState,
        updateOrderItemQty,
        removeOrderItemFromBucket,
        addOrderItemToBucket,
        addNewPantryItemToOrder,
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
