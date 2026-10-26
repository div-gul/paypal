import {
  ActivityLogItem,
  PantryItem,
  SimulationState,
  WeeklySchedulerConfig,
} from '@shared/types';
import {
  INITIAL_SIMULATED_DATE,
  INITIAL_NEXT_SHOPPING_DATE,
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
  DEFAULT_ACTIVITY_LOG,
} from '@shared/services/defaults';

export {
  INITIAL_SIMULATED_DATE,
  INITIAL_NEXT_SHOPPING_DATE,
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
  DEFAULT_ACTIVITY_LOG,
};

const STORAGE_KEYS = {
  PANTRY: 'shoppilot_pantry_items_v2',
  SCHEDULER_CONFIG: 'shoppilot_scheduler_config_v2',
  SIMULATION_STATE: 'shoppilot_sim_state_v2',
  ACTIVITY_LOG: 'shoppilot_activity_log_v2',
  ACTIVE_STRATEGY_TYPE: 'shoppilot_active_strategy_v2',
};

export const StorageService = {
  getPantry(): PantryItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PANTRY);
      return data ? JSON.parse(data) : DEFAULT_PANTRY_ITEMS;
    } catch {
      return DEFAULT_PANTRY_ITEMS;
    }
  },

  savePantry(items: PantryItem[]): void {
    localStorage.setItem(STORAGE_KEYS.PANTRY, JSON.stringify(items));
  },

  getSchedulerConfig(): WeeklySchedulerConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHEDULER_CONFIG);
      return data ? JSON.parse(data) : DEFAULT_SCHEDULER_CONFIG;
    } catch {
      return DEFAULT_SCHEDULER_CONFIG;
    }
  },

  saveSchedulerConfig(config: WeeklySchedulerConfig): void {
    localStorage.setItem(STORAGE_KEYS.SCHEDULER_CONFIG, JSON.stringify(config));
  },

  getSimulationState(): SimulationState {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SIMULATION_STATE);
      return data ? JSON.parse(data) : DEFAULT_SIMULATION_STATE;
    } catch {
      return DEFAULT_SIMULATION_STATE;
    }
  },

  saveSimulationState(state: SimulationState): void {
    localStorage.setItem(STORAGE_KEYS.SIMULATION_STATE, JSON.stringify(state));
  },

  getActivityLog(): ActivityLogItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
      return data ? JSON.parse(data) : DEFAULT_ACTIVITY_LOG;
    } catch {
      return DEFAULT_ACTIVITY_LOG;
    }
  },

  saveActivityLog(log: ActivityLogItem[]): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(log));
  },

  resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.PANTRY);
    localStorage.removeItem(STORAGE_KEYS.SCHEDULER_CONFIG);
    localStorage.removeItem(STORAGE_KEYS.SIMULATION_STATE);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOG);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_STRATEGY_TYPE);
  },
};
