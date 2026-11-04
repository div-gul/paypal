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

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'guest';
}

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/api') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const config: RequestInit = {
    ...options,
    credentials: 'same-origin',
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
    if (response.status === 401 && !['/auth/me', '/auth/login', '/auth/register', '/auth/logout'].includes(endpoint)) {
      window.dispatchEvent(new Event('shoppilot:session-expired'));
    }
    const errorPayload = data as ApiResponseError | undefined;
    const code = errorPayload?.error?.code || `HTTP_${response.status}`;
    const message = errorPayload?.error?.message || `Request failed with status ${response.status}`;
    const details = errorPayload?.error?.details;
    throw new ApiError(message, code, response.status, details);
  }

  return data as T;
}

export const api = {
  getCurrentUser: () => request<{ user: AuthUser }>('/auth/me'),
  login: (email: string, password: string) => request<{ user: AuthUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  register: (name: string, email: string, password: string) => request<{ user: AuthUser }>('/auth/register', {
    method: 'POST', body: JSON.stringify({ name, email, password }),
  }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  getWorkspace: () => request<{ upcomingOrder: any | null; swapDecisions: Record<string, 'approved' | 'rejected'> }>('/workspace'),
  saveWorkspace: (workspace: { upcomingOrder?: any | null; swapDecisions?: Record<string, 'approved' | 'rejected'> }) => request<{ success: boolean }>('/workspace', {
    method: 'PUT', body: JSON.stringify(workspace),
  }),

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
  createOrderRun: (items: Array<{ pantryItemId: string; storeProductId: string; quantity: number }>) =>
    request<{ run: any }>('/runs/order', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  approveRun: (id: string) =>
    request<{ run: any }>(`/runs/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  rejectRun: (id: string) =>
    request<{ run: any }>(`/runs/${encodeURIComponent(id)}/reject`, { method: 'POST' }),

  // Checkout & Payments
  getCheckoutConfig: () => request<{
    mode: 'mock' | 'sandbox';
    clientId: string | null;
    currency: string;
    provider: 'mock' | 'paypal_sandbox';
  }>('/checkout/config'),
  createCheckoutOrder: (runId: string) =>
    request<{
      orderId: string;
      approvalUrl?: string;
      amountPaise: number;
      currency: string;
      chargedAmount?: string;
      status: string;
      provider: 'mock' | 'paypal_sandbox';
      run: any;
    }>('/checkout/create-order', {
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
  getCheckoutStatus: (runId: string) =>
    request<{
      runId: string;
      orderId: string | null;
      paymentState: 'PENDING' | 'APPROVED' | 'CAPTURED' | 'FAILED' | 'CANCELLED';
      approvalUrl?: string | null;
      receipt?: any;
      chargedAmount?: string;
      currency?: string;
    }>(`/checkout/status/${encodeURIComponent(runId)}`),
  cancelCheckoutOrder: (runId: string, orderId?: string) =>
    request<{ runId: string; orderId: string; paymentState: string; approvalUrl?: string | null }>('/checkout/cancel', {
      method: 'POST',
      body: JSON.stringify({ runId, orderId }),
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
