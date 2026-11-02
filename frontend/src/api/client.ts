import {
  ActivityLogItem,
  BasketStrategyResult,
  BasketStrategyType,
  PantryItem,
  RestockRecommendation,
  SimulationState,
  StoreProduct,
  WeeklySchedulerConfig,
} from '@shared/types';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ApiResponseError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface StateResponse {
  pantry: PantryItem[];
  policy: WeeklySchedulerConfig;
  clock: SimulationState;
  activeRun: any | null;
  recentAuditLog: ActivityLogItem[];
}

export interface PlanRunOverrides {
  includeItemIds?: string[];
  excludeItemIds?: string[];
  strategy?: BasketStrategyType;
}

export interface PlanRunResponse {
  run: any;
  recommendations: RestockRecommendation[];
  strategies: BasketStrategyResult[];
  recommendedStrategy: BasketStrategyResult;
}

export interface QuotesResponse {
  totalQuotes: number;
  quotes: StoreProduct[];
}

export interface AiPolicyProposal {
  preferredShoppingDay?: number;
  shoppingFrequency?: 'weekly' | 'biweekly';
  emergencyRestockPreference?: 'auto_order' | 'ask_approval' | 'alert_only';
  urgentThresholdDays?: number;
  perCycleBudgetPaise?: number;
  perOrderCapPaise?: number;
  requireApprovalBrandSubstitution?: boolean;
  blockedCategories?: string[];
  explanation: string;
  changesSummary: string[];
}

export interface AiSubstituteResult {
  selectedProductId: string;
  productName: string;
  brand: string;
  pricePaise: number;
  confidence: number;
  reasoning: string;
}

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/api') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload = data as ApiResponseError | undefined;
    const code = errorPayload?.error?.code || `HTTP_${response.status}`;
    const message = errorPayload?.error?.message || `Request failed with status ${response.status}`;
    const details = errorPayload?.error?.details;
    throw new ApiError(message, code, response.status, details);
  }

  return data as T;
}

export const api = {
  // State
  getState: () => request<StateResponse>('/state'),
  resetState: () => request<{ success: boolean; message: string }>('/state/reset', { method: 'POST' }),

  // Pantry CRUD
  getPantry: () => request<{ items: PantryItem[] }>('/pantry'),
  getPantryItem: (id: string) => request<{ item: PantryItem }>(`/pantry/${encodeURIComponent(id)}`),
  createPantryItem: (item: Partial<PantryItem>) =>
    request<{ item: PantryItem }>('/pantry', {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  updatePantryItem: (id: string, item: Partial<PantryItem>) =>
    request<{ item: PantryItem }>(`/pantry/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    }),
  deletePantryItem: (id: string) =>
    request<{ success: boolean; message: string }>(`/pantry/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  adjustPantryQuantity: (id: string, delta: number) =>
    request<{ item: PantryItem }>(`/pantry/${encodeURIComponent(id)}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    }),

  // Policy & Schedule
  getPolicy: () => request<{ policy: WeeklySchedulerConfig }>('/policy'),
  updatePolicy: (policy: Partial<WeeklySchedulerConfig>) =>
    request<{ policy: WeeklySchedulerConfig }>('/policy', {
      method: 'PUT',
      body: JSON.stringify(policy),
    }),

  // Time Machine
  getClock: () => request<{ clock: SimulationState }>('/time'),
  advanceTime: (days: 1 | 3 | 7) =>
    request<{ clock: SimulationState; depletedItems: PantryItem[]; stockoutWarnings: string[] }>(
      '/time/advance',
      {
        method: 'POST',
        body: JSON.stringify({ days }),
      }
    ),

  // Runs & Basket Optimization
  planRun: (overrides?: PlanRunOverrides) =>
    request<PlanRunResponse>('/runs/plan', {
      method: 'POST',
      body: overrides ? JSON.stringify(overrides) : undefined,
    }),
  getRun: (id: string) => request<{ run: any; items: any[] }>(`/runs/${encodeURIComponent(id)}`),
  getRuns: (limit: number = 20) => request<{ runs: any[] }>(`/runs?limit=${limit}`),
  changeRunStrategy: (id: string, strategy: BasketStrategyType) =>
    request<PlanRunResponse>(`/runs/${encodeURIComponent(id)}/strategy`, {
      method: 'PUT',
      body: JSON.stringify({ strategy }),
    }),
  approveRun: (id: string) =>
    request<{ run: any }>(`/runs/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  rejectRun: (id: string) =>
    request<{ run: any }>(`/runs/${encodeURIComponent(id)}/reject`, { method: 'POST' }),

  // Configuration
  getPublicConfig: () =>
    request<{
      paypalClientId: string;
      paypalMode: 'mock' | 'sandbox';
      currency: string;
      usdRate: number;
    }>('/config/public'),

  // Checkout & Payments
  createCheckoutOrder: (runId: string) =>
    request<{ orderId: string; run: any }>('/checkout/create-order', {
      method: 'POST',
      body: JSON.stringify({ runId }),
    }),
  captureCheckoutOrder: (orderId: string, runId?: string) =>
    request<{
      success: boolean;
      receipt: any;
      run: any;
      alreadyCaptured: boolean;
    }>('/checkout/capture', {
      method: 'POST',
      body: JSON.stringify({ orderId, runId }),
    }),

  // Store Quotes & Sources
  getQuotes: () => request<QuotesResponse>('/quotes'),

  // Audit Log
  getAuditLog: (limit: number = 50) => request<{ logs: ActivityLogItem[] }>(`/audit-log?limit=${limit}`),

  // AI Endpoints
  parsePolicyAI: (prompt: string) =>
    request<{ proposal: AiPolicyProposal }>('/ai/parse-policy', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  substituteAI: (params: {
    pantryItemId: string;
    itemName: string;
    preferredBrand: string;
    candidates: StoreProduct[];
    reason?: string;
  }) =>
    request<{ substitute: AiSubstituteResult }>('/ai/substitute', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
