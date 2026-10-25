import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from 'react';
import {
  ActivityLogItem,
  BasketItem,
  BasketStrategyResult,
  BasketStrategyType,
  PantryItem,
  RestockDecisionOutcome,
  RestockRecommendation,
  SimulationState,
  WeeklySchedulerConfig,
} from '../types';
import {
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
  DEFAULT_ACTIVITY_LOG,
  StorageService,
} from '../services/storageService';
import { advancePantryState } from '../services/consumptionEngine';
import { generateRestockRecommendations } from '../services/restockScheduler';
import { optimizeBaskets } from '../services/basketOptimizer';
import { formatPaise } from '../services/currency';

interface CheckoutModalDetails {
  isOpen: boolean;
  strategy?: BasketStrategyResult;
  orderId?: string;
  timestamp?: string;
  itemsPurchased?: BasketItem[];
}

interface ShopPilotContextType {
  // State
  pantryItems: PantryItem[];
  schedulerConfig: WeeklySchedulerConfig;
  simulationState: SimulationState;
  recommendations: RestockRecommendation[];
  optimizationResult: {
    strategies: BasketStrategyResult[];
    recommendedStrategy: BasketStrategyResult;
  } | null;
  selectedStrategyType: BasketStrategyType;
  activityLog: ActivityLogItem[];
  isAnalyzing: boolean;
  checkoutModal: CheckoutModalDetails;
  showDemoInfoModal: boolean;

  // Actions
  updatePantryItem: (item: PantryItem) => void;
  addPantryItem: (item: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>) => void;
  deletePantryItem: (id: string) => void;
  quickAdjustQuantity: (id: string, delta: number) => void;
  updateSchedulerConfig: (config: Partial<WeeklySchedulerConfig>) => void;
  advanceTime: (days: number) => Promise<void>;
  runShoppingAnalysis: () => Promise<void>;
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
  resetToInitialDemo: () => void;
  setShowDemoInfoModal: (show: boolean) => void;
}

const ShopPilotContext = createContext<ShopPilotContextType | null>(null);

export const ShopPilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(() => StorageService.getPantry());
  const [schedulerConfig, setSchedulerConfig] = useState<WeeklySchedulerConfig>(() =>
    StorageService.getSchedulerConfig()
  );
  const [simulationState, setSimulationState] = useState<SimulationState>(() =>
    StorageService.getSimulationState()
  );
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>(() => StorageService.getActivityLog());

  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<{
    strategies: BasketStrategyResult[];
    recommendedStrategy: BasketStrategyResult;
  } | null>(null);

  const [selectedStrategyType, setSelectedStrategyType] = useState<BasketStrategyType>(
    'STRATEGY_B_SINGLE_STORE'
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [, startTransition] = useTransition();
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalDetails>({ isOpen: false });
  const [showDemoInfoModal, setShowDemoInfoModal] = useState(false);

  // Helper to log auditable events
  const logEvent = useCallback(
    (
      type: ActivityLogItem['type'],
      title: string,
      description: string,
      statusBadge?: string,
      badgeColor?: ActivityLogItem['badgeColor']
    ) => {
      const newEntry: ActivityLogItem = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        simulatedDate: simulationState.simulatedDate,
        type,
        title,
        description,
        statusBadge,
        badgeColor: badgeColor || 'blue',
      };

      setActivityLog(prev => {
        const updated = [newEntry, ...prev.slice(0, 99)]; // Keep latest 100 entries
        StorageService.saveActivityLog(updated);
        return updated;
      });
    },
    [simulationState.simulatedDate]
  );

  // Compute recommendations and basket optimization
  const refreshAnalysis = useCallback(
    async (currentPantry: PantryItem[], currentConfig: WeeklySchedulerConfig, currentSim: SimulationState) => {
      setIsAnalyzing(true);
      try {
        const recs = await generateRestockRecommendations({
          simulatedDate: currentSim.simulatedDate,
          config: currentConfig,
          pantryItems: currentPantry,
        });

        const opt = optimizeBaskets({
          recommendations: recs,
          pantryItems: currentPantry,
        });

        startTransition(() => {
          setRecommendations(recs);
          setOptimizationResult(opt);
          if (opt.recommendedStrategy) {
            setSelectedStrategyType(opt.recommendedStrategy.type);
          }
        });
      } catch (err) {
        console.error('Error generating analysis:', err);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Initial analysis on mount
  useEffect(() => {
    refreshAnalysis(pantryItems, schedulerConfig, simulationState);
  }, []);

  // Update pantry item
  const updatePantryItem = useCallback(
    (updated: PantryItem) => {
      setPantryItems(prev => {
        const next = prev.map(item => (item.id === updated.id ? updated : item));
        StorageService.savePantry(next);
        refreshAnalysis(next, schedulerConfig, simulationState);
        return next;
      });

      logEvent(
        'pantry_updated',
        `Pantry Updated: ${updated.name}`,
        `Stock: ${updated.currentQuantity} ${updated.unit}, Daily Consumption: ${updated.averageDailyConsumption} ${updated.unit}/day. Min stock: ${updated.minStockThreshold} ${updated.unit}.`,
        'Edited',
        'blue'
      );
    },
    [schedulerConfig, simulationState, refreshAnalysis, logEvent]
  );

  // Add new pantry item
  const addPantryItem = useCallback(
    (itemData: Omit<PantryItem, 'id' | 'lastRestockedDate' | 'stockoutDaysCount'>) => {
      const newItem: PantryItem = {
        ...itemData,
        id: `item-${Date.now()}`,
        lastRestockedDate: simulationState.simulatedDate,
        stockoutDaysCount: 0,
      };

      setPantryItems(prev => {
        const next = [...prev, newItem];
        StorageService.savePantry(next);
        refreshAnalysis(next, schedulerConfig, simulationState);
        return next;
      });

      logEvent(
        'pantry_updated',
        `Added to Pantry: ${newItem.name}`,
        `Configured initial stock of ${newItem.currentQuantity} ${newItem.unit} (${newItem.preferredBrand}).`,
        'New Item',
        'emerald'
      );
    },
    [simulationState, schedulerConfig, refreshAnalysis, logEvent]
  );

  // Delete pantry item
  const deletePantryItem = useCallback(
    (id: string) => {
      setPantryItems(prev => {
        const target = prev.find(p => p.id === id);
        const next = prev.filter(p => p.id !== id);
        StorageService.savePantry(next);
        refreshAnalysis(next, schedulerConfig, simulationState);

        if (target) {
          logEvent(
            'pantry_updated',
            `Removed: ${target.name}`,
            `Removed ${target.name} from autonomous inventory tracking.`,
            'Deleted',
            'rose'
          );
        }
        return next;
      });
    },
    [schedulerConfig, simulationState, refreshAnalysis, logEvent]
  );

  // Quick adjust quantity (+/- button)
  const quickAdjustQuantity = useCallback(
    (id: string, delta: number) => {
      setPantryItems(prev => {
        const next = prev.map(p => {
          if (p.id !== id) return p;
          const newQty = Math.max(0, Math.round((p.currentQuantity + delta) * 100) / 100);
          return {
            ...p,
            currentQuantity: newQty,
            stockoutDaysCount: newQty === 0 ? p.stockoutDaysCount + 1 : 0,
          };
        });
        StorageService.savePantry(next);
        refreshAnalysis(next, schedulerConfig, simulationState);
        return next;
      });
    },
    [schedulerConfig, simulationState, refreshAnalysis]
  );

  // Update scheduler settings
  const updateSchedulerConfig = useCallback(
    (updates: Partial<WeeklySchedulerConfig>) => {
      setSchedulerConfig(prev => {
        const next = { ...prev, ...updates };
        StorageService.saveSchedulerConfig(next);
        refreshAnalysis(pantryItems, next, simulationState);
        return next;
      });

      logEvent(
        'policy_applied',
        'Restocking Policy Updated',
        `Schedule or budget configuration modified. Budget: ${formatPaise(
          updates.perCycleBudgetPaise ?? schedulerConfig.perCycleBudgetPaise
        )}. Emergency policy: ${updates.emergencyRestockPreference ?? schedulerConfig.emergencyRestockPreference}.`,
        'Policy Saved',
        'purple'
      );
    },
    [pantryItems, simulationState, schedulerConfig, refreshAnalysis, logEvent]
  );

  // Advance simulation time
  const advanceTime = useCallback(
    async (days: number) => {
      if (days <= 0) return;

      const currentDate = new Date(simulationState.simulatedDate);
      currentDate.setDate(currentDate.getDate() + days);
      const newSimDateIso = currentDate.toISOString();

      const newSimulationState: SimulationState = {
        simulatedDate: newSimDateIso,
        daysElapsed: simulationState.daysElapsed + days,
        cycleCount: simulationState.cycleCount + (days >= 7 ? 1 : 0),
      };

      // Advance pantry consumption
      const updatedPantry = advancePantryState(pantryItems, days);

      // Check if scheduled run was passed
      const nextRunDate = new Date(schedulerConfig.nextShoppingDate);
      let updatedSchedulerConfig = { ...schedulerConfig };

      if (currentDate >= nextRunDate) {
        // Shopping run date reached! Move next scheduled date ahead by 7 or 14 days
        const daysToNext = schedulerConfig.shoppingFrequency === 'weekly' ? 7 : 14;
        const advancedShoppingDate = new Date(nextRunDate);
        advancedShoppingDate.setDate(advancedShoppingDate.getDate() + daysToNext);
        updatedSchedulerConfig.nextShoppingDate = advancedShoppingDate.toISOString();
        StorageService.saveSchedulerConfig(updatedSchedulerConfig);
        setSchedulerConfig(updatedSchedulerConfig);
      }

      // Check for stockouts that just occurred
      updatedPantry.forEach(item => {
        const oldItem = pantryItems.find(p => p.id === item.id);
        if (oldItem && oldItem.currentQuantity > 0 && item.currentQuantity === 0) {
          logEvent(
            'stockout_warning',
            `Stockout Alert: ${item.name}`,
            `Item has completely run out (0 ${item.unit} remaining). Urgent restocking required!`,
            'Stockout',
            'red'
          );
        }
      });

      // Save state
      setPantryItems(updatedPantry);
      setSimulationState(newSimulationState);
      StorageService.savePantry(updatedPantry);
      StorageService.saveSimulationState(newSimulationState);

      const simDateFormatted = currentDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      logEvent(
        'time_advanced',
        `Time Fast-Forwarded +${days} Day${days > 1 ? 's' : ''}`,
        `Household consumption applied. Simulated date is now ${simDateFormatted}. Pantry stock depleted accordingly.`,
        `+${days}d Sim`,
        'indigo'
      );

      // Refresh analysis with new state
      await refreshAnalysis(updatedPantry, updatedSchedulerConfig, newSimulationState);
    },
    [simulationState, pantryItems, schedulerConfig, refreshAnalysis, logEvent]
  );

  // Manual trigger for shopping analysis
  const runShoppingAnalysis = useCallback(async () => {
    await refreshAnalysis(pantryItems, schedulerConfig, simulationState);
    logEvent(
      'analysis_run',
      'Autonomous Restock Analysis Run',
      'Evaluated current inventory, consumption burn rates, and mock store inventories for Blinkit, Zepto, and Instamart.',
      'Refreshed',
      'blue'
    );
  }, [pantryItems, schedulerConfig, simulationState, refreshAnalysis, logEvent]);

  // Approval actions
  const approveRecommendation = useCallback(
    (itemId: string) => {
      setRecommendations(prev => {
        const next = prev.map(r => {
          if (r.itemId !== itemId) return r;
          const pantry = pantryItems.find(p => p.id === itemId);
          const neededQty =
            r.recommendedQuantity > 0
              ? r.recommendedQuantity
              : Math.max(1, Math.ceil((pantry?.targetStock || 2) - (pantry?.currentQuantity || 0)));
          return {
            ...r,
            approvalStatus: 'approved' as const,
            requiresApproval: false,
            outcome: (r.isUrgent ? 'RESTOCK_NOW' : 'INCLUDE_IN_WEEKLY_BASKET') as RestockDecisionOutcome,
            recommendedQuantity: neededQty,
          };
        });
        const opt = optimizeBaskets({ recommendations: next, pantryItems });
        setOptimizationResult(opt);
        return next;
      });

      const item = pantryItems.find(p => p.id === itemId);
      logEvent(
        'approval_granted',
        `Substitution / Purchase Approved: ${item ? item.name : itemId}`,
        'User manually approved proposed brand substitution or off-cycle emergency purchase.',
        'Approved',
        'emerald'
      );
    },
    [pantryItems, logEvent]
  );

  const includeInWeeklyBasket = useCallback(
    (itemId: string) => {
      setRecommendations(prev => {
        const next = prev.map(r => {
          if (r.itemId !== itemId) return r;
          const pantry = pantryItems.find(p => p.id === itemId);
          const neededQty =
            r.recommendedQuantity > 0
              ? r.recommendedQuantity
              : Math.max(1, Math.ceil((pantry?.targetStock || 2) - (pantry?.currentQuantity || 0)));
          return {
            ...r,
            outcome: 'INCLUDE_IN_WEEKLY_BASKET' as const,
            approvalStatus: 'approved' as const,
            requiresApproval: false,
            recommendedQuantity: neededQty,
            reasoning: `Manually bundled into the weekly shopping basket by user to consolidate delivery fees.`,
          };
        });
        const opt = optimizeBaskets({ recommendations: next, pantryItems });
        setOptimizationResult(opt);
        return next;
      });

      const item = pantryItems.find(p => p.id === itemId);
      logEvent(
        'recommendation_made',
        `Added to Weekly Basket: ${item ? item.name : itemId}`,
        'User explicitly bundled item into weekly scheduled basket.',
        'Weekly Basket',
        'emerald'
      );
    },
    [pantryItems, logEvent]
  );

  const includeInUrgentBasket = useCallback(
    (itemId: string) => {
      setRecommendations(prev => {
        const next = prev.map(r => {
          if (r.itemId !== itemId) return r;
          const pantry = pantryItems.find(p => p.id === itemId);
          const neededQty =
            r.recommendedQuantity > 0
              ? r.recommendedQuantity
              : Math.max(1, Math.ceil((pantry?.targetStock || 2) - (pantry?.currentQuantity || 0)));
          return {
            ...r,
            outcome: 'RESTOCK_NOW' as const,
            approvalStatus: 'approved' as const,
            requiresApproval: false,
            recommendedQuantity: neededQty,
            isUrgent: true,
            reasoning: `Approved for immediate off-cycle emergency order.`,
          };
        });
        const opt = optimizeBaskets({ recommendations: next, pantryItems });
        setOptimizationResult(opt);
        return next;
      });

      const item = pantryItems.find(p => p.id === itemId);
      logEvent(
        'recommendation_made',
        `Added to Immediate Urgent Order: ${item ? item.name : itemId}`,
        'User scheduled immediate urgent restock for item.',
        'Restock Now',
        'red'
      );
    },
    [pantryItems, logEvent]
  );

  const removeFromBasket = useCallback(
    (itemId: string) => {
      setRecommendations(prev => {
        const next = prev.map(r => {
          if (r.itemId !== itemId) return r;
          return {
            ...r,
            outcome: 'WAIT_UNTIL_NEXT_CYCLE' as const,
            recommendedQuantity: 0,
            reasoning: `Manually deferred by user from current restock basket.`,
          };
        });
        const opt = optimizeBaskets({ recommendations: next, pantryItems });
        setOptimizationResult(opt);
        return next;
      });

      const item = pantryItems.find(p => p.id === itemId);
      logEvent(
        'recommendation_made',
        `Deferred: ${item ? item.name : itemId}`,
        'User removed item from active shopping basket.',
        'Deferred',
        'blue'
      );
    },
    [pantryItems, logEvent]
  );

  const approveAllUrgentItems = useCallback(() => {
    setRecommendations(prev => {
      const next = prev.map(r => {
        if (!r.isUrgent && r.outcome !== 'ASK_FOR_APPROVAL') return r;
        const pantry = pantryItems.find(p => p.id === r.itemId);
        const neededQty =
          r.recommendedQuantity > 0
            ? r.recommendedQuantity
            : Math.max(1, Math.ceil((pantry?.targetStock || 2) - (pantry?.currentQuantity || 0)));
        return {
          ...r,
          approvalStatus: 'approved' as const,
          requiresApproval: false,
          outcome: 'RESTOCK_NOW' as const,
          recommendedQuantity: neededQty,
        };
      });
      const opt = optimizeBaskets({ recommendations: next, pantryItems });
      setOptimizationResult(opt);
      return next;
    });

    logEvent(
      'approval_granted',
      'Approved All Urgent Restock Items',
      'All urgent inventory items approved and added into active order basket.',
      'All Urgents Approved',
      'emerald'
    );
  }, [pantryItems, logEvent]);

  const rejectRecommendation = useCallback(
    (itemId: string) => {
      setRecommendations(prev => {
        const next = prev.map(r =>
          r.itemId === itemId ? { ...r, approvalStatus: 'rejected' as const, outcome: 'BLOCKED' as const } : r
        );
        const opt = optimizeBaskets({ recommendations: next, pantryItems });
        setOptimizationResult(opt);
        return next;
      });

      const item = pantryItems.find(p => p.id === itemId);
      logEvent(
        'approval_rejected',
        `Recommendation Rejected: ${item ? item.name : itemId}`,
        'User rejected proposed substitution or urgent restocking item.',
        'Rejected',
        'rose'
      );
    },
    [pantryItems, logEvent]
  );

  // Checkout Modal triggers
  const openCheckoutModal = useCallback((strategy: BasketStrategyResult) => {
    setCheckoutModal({
      isOpen: true,
      strategy,
    });
  }, []);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutModal({ isOpen: false });
  }, []);

  // Confirm Simulated Checkout
  const confirmSimulatedPayment = useCallback(
    async (strategy: BasketStrategyResult) => {
      const orderId = `PAYPAL-MOCK-${Math.floor(100000 + Math.random() * 900000)}`;
      const allPurchasedItems: BasketItem[] = [];

      // Collect all items across store baskets
      strategy.storeBaskets.forEach(basket => {
        basket.items.forEach(item => {
          allPurchasedItems.push(item);
        });
      });

      // Update pantry inventory
      setPantryItems(prev => {
        const next = prev.map(pantryItem => {
          const purchased = allPurchasedItems.find(b => b.pantryItemId === pantryItem.id);
          if (purchased) {
            // Restore inventory to targetStock or add purchased quantity
            const addedQty = purchased.quantity;
            const updatedStock = Math.round((pantryItem.currentQuantity + addedQty) * 100) / 100;
            return {
              ...pantryItem,
              currentQuantity: Math.max(pantryItem.targetStock, updatedStock),
              lastRestockedDate: simulationState.simulatedDate,
              stockoutDaysCount: 0,
            };
          }
          return pantryItem;
        });

        StorageService.savePantry(next);
        // Refresh analysis with replenished pantry
        refreshAnalysis(next, schedulerConfig, simulationState);
        return next;
      });

      // Log checkout event
      const storeNames = strategy.storeBaskets.map(b => b.storeName).join(' + ');
      logEvent(
        'checkout_completed',
        `Simulated PayPal Checkout Complete (${orderId})`,
        `Successfully placed order across ${storeNames} for ${formatPaise(
          strategy.grandTotalPaise
        )}. ${allPurchasedItems.length} pantry items replenished to target levels.`,
        'Paid ₹',
        'emerald'
      );

      setCheckoutModal({
        isOpen: true,
        strategy,
        orderId,
        timestamp: new Date().toLocaleTimeString(),
        itemsPurchased: allPurchasedItems,
      });
    },
    [simulationState, schedulerConfig, refreshAnalysis, logEvent]
  );

  // Reset demo
  const resetToInitialDemo = useCallback(() => {
    StorageService.resetAll();
    setPantryItems(DEFAULT_PANTRY_ITEMS);
    setSchedulerConfig(DEFAULT_SCHEDULER_CONFIG);
    setSimulationState(DEFAULT_SIMULATION_STATE);
    setActivityLog(DEFAULT_ACTIVITY_LOG);
    refreshAnalysis(DEFAULT_PANTRY_ITEMS, DEFAULT_SCHEDULER_CONFIG, DEFAULT_SIMULATION_STATE);
  }, [refreshAnalysis]);

  return (
    <ShopPilotContext.Provider
      value={{
        pantryItems,
        schedulerConfig,
        simulationState,
        recommendations,
        optimizationResult,
        selectedStrategyType,
        activityLog,
        isAnalyzing,
        checkoutModal,
        showDemoInfoModal,
        updatePantryItem,
        addPantryItem,
        deletePantryItem,
        quickAdjustQuantity,
        updateSchedulerConfig,
        advanceTime,
        runShoppingAnalysis,
        approveRecommendation,
        rejectRecommendation,
        includeInWeeklyBasket,
        includeInUrgentBasket,
        removeFromBasket,
        approveAllUrgentItems,
        setSelectedStrategyType,
        openCheckoutModal,
        closeCheckoutModal,
        confirmSimulatedPayment,
        resetToInitialDemo,
        setShowDemoInfoModal,
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
