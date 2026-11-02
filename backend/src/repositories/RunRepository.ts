import Database from 'better-sqlite3';
import { BasketStrategyResult, BasketStrategyType } from '@shared/types';
import type { PaymentState } from '../services/payment/PaymentProvider.js';

export type RunStatus =
  | 'planned'
  | 'needs_approval'
  | 'approved'
  | 'auto_approved'
  | 'payment_pending'
  | 'paid'
  | 'failed'
  | 'rejected'
  | 'blocked';

export interface RunRecord {
  id: string;
  userId: string;
  status: RunStatus;
  strategyType: BasketStrategyType;
  grandTotalPaise: number;
  productSubtotalPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  taxPaise: number;
  discountPaise: number;
  decisionReasons: string[];
  selectedStrategyDetails: BasketStrategyResult | null;
  allStrategies?: BasketStrategyResult[] | null;
  orderId?: string | null;
  paymentState: PaymentState;
  paypalApprovalUrl?: string | null;
  paymentAmount?: string | null;
  paymentCurrency?: string | null;
  paypalCaptureId?: string | null;
  paymentDetails?: string | null;
  simulatedDate: string;
  createdAt: string;
  updatedAt: string;
}

interface RunRow {
  id: string;
  user_id: string;
  status: RunStatus;
  strategy_type: BasketStrategyType;
  grand_total_paise: number;
  product_subtotal_paise: number;
  delivery_fee_paise: number;
  handling_fee_paise: number;
  tax_paise: number;
  discount_paise: number;
  decision_reasons: string;
  selected_strategy_details: string | null;
  all_strategies?: string | null;
  order_id?: string | null;
  payment_state?: PaymentState;
  paypal_approval_url?: string | null;
  payment_amount?: string | null;
  payment_currency?: string | null;
  paypal_capture_id?: string | null;
  payment_details?: string | null;
  simulated_date: string;
  created_at: string;
  updated_at: string;
}

function rowToRun(row: RunRow): RunRecord {
  let reasons: string[] = [];
  try {
    reasons = JSON.parse(row.decision_reasons);
  } catch {
    reasons = [];
  }

  let strategyDetails: BasketStrategyResult | null = null;
  try {
    strategyDetails = row.selected_strategy_details ? JSON.parse(row.selected_strategy_details) : null;
  } catch {
    strategyDetails = null;
  }

  let allStrategies: BasketStrategyResult[] | null = null;
  try {
    allStrategies = row.all_strategies ? JSON.parse(row.all_strategies) : null;
  } catch {
    allStrategies = null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    strategyType: row.strategy_type,
    grandTotalPaise: row.grand_total_paise,
    productSubtotalPaise: row.product_subtotal_paise,
    deliveryFeePaise: row.delivery_fee_paise,
    handlingFeePaise: row.handling_fee_paise,
    taxPaise: row.tax_paise,
    discountPaise: row.discount_paise,
    decisionReasons: reasons,
    selectedStrategyDetails: strategyDetails,
    allStrategies,
    orderId: row.order_id || null,
    paymentState: row.payment_state || 'PENDING',
    paypalApprovalUrl: row.paypal_approval_url || null,
    paymentAmount: row.payment_amount || null,
    paymentCurrency: row.payment_currency || null,
    paypalCaptureId: row.paypal_capture_id || null,
    paymentDetails: row.payment_details || null,
    simulatedDate: row.simulated_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RunRepository {
  constructor(private db: Database.Database) {}

  create(userId: string, data: {
    id: string;
    status: RunStatus;
    strategyType: BasketStrategyType;
    grandTotalPaise: number;
    productSubtotalPaise: number;
    deliveryFeePaise: number;
    handlingFeePaise: number;
    taxPaise: number;
    discountPaise?: number;
    decisionReasons: string[];
    selectedStrategyDetails?: BasketStrategyResult;
    allStrategies?: BasketStrategyResult[];
    orderId?: string;
    simulatedDate: string;
  }): RunRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO runs (
        id, user_id, status, strategy_type, grand_total_paise,
        product_subtotal_paise, delivery_fee_paise, handling_fee_paise,
        tax_paise, discount_paise, decision_reasons,
        selected_strategy_details, all_strategies, order_id,
        simulated_date, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(
      data.id,
      userId,
      data.status,
      data.strategyType,
      data.grandTotalPaise,
      data.productSubtotalPaise,
      data.deliveryFeePaise,
      data.handlingFeePaise,
      data.taxPaise,
      data.discountPaise || 0,
      JSON.stringify(data.decisionReasons),
      data.selectedStrategyDetails ? JSON.stringify(data.selectedStrategyDetails) : null,
      data.allStrategies ? JSON.stringify(data.allStrategies) : null,
      data.orderId || null,
      data.simulatedDate,
      now,
      now
    ) as RunRow;

    return rowToRun(row);
  }

  getById(userId: string, id: string): RunRecord | null {
    const stmt = this.db.prepare('SELECT * FROM runs WHERE user_id = ? AND id = ?');
    const row = stmt.get(userId, id) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  }

  findByOrderId(orderId: string): RunRecord | null {
    const stmt = this.db.prepare('SELECT * FROM runs WHERE order_id = ? LIMIT 1');
    const row = stmt.get(orderId) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  }

  getLatest(userId: string): RunRecord | null {
    const stmt = this.db.prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(userId) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  }

  getAll(userId: string, limit: number = 20): RunRecord[] {
    const stmt = this.db.prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(userId, limit) as RunRow[];
    return rows.map(rowToRun);
  }

  updateStatus(userId: string, id: string, newStatus: RunStatus): RunRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE runs
      SET status = ?,
          payment_state = CASE
            WHEN ? = 'paid' THEN 'CAPTURED'
            WHEN ? = 'failed' THEN 'FAILED'
            ELSE payment_state
          END,
          updated_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);
    const row = stmt.get(newStatus, newStatus, newStatus, now, userId, id) as RunRow | undefined;
    if (!row) {
      throw new Error(`Run ${id} not found for user ${userId}`);
    }
    return rowToRun(row);
  }

  setOrderId(userId: string, id: string, payment: {
    orderId: string;
    approvalUrl?: string;
    amount?: string;
    currency?: string;
  }): RunRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE runs
      SET order_id = ?, status = 'payment_pending', payment_state = 'PENDING',
          paypal_approval_url = ?, payment_amount = ?, payment_currency = ?,
          paypal_capture_id = NULL, payment_details = NULL, updated_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);
    const row = stmt.get(payment.orderId, payment.approvalUrl || null, payment.amount || null, payment.currency || null, now, userId, id) as RunRow | undefined;
    if (!row) {
      throw new Error(`Run ${id} not found for user ${userId}`);
    }
    return rowToRun(row);
  }

  setPaymentState(
    userId: string,
    id: string,
    state: PaymentState,
    details?: { captureId?: string; paymentDetails?: string }
  ): RunRecord {
    const stmt = this.db.prepare(`
      UPDATE runs
      SET payment_state = ?,
          paypal_capture_id = COALESCE(?, paypal_capture_id),
          payment_details = COALESCE(?, payment_details),
          updated_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);
    const row = stmt.get(state, details?.captureId || null, details?.paymentDetails || null, new Date().toISOString(), userId, id) as RunRow | undefined;
    if (!row) throw new Error(`Run ${id} not found for user ${userId}`);
    return rowToRun(row);
  }

  updateRunStrategy(userId: string, id: string, data: {
    status: RunStatus;
    strategyType: BasketStrategyType;
    grandTotalPaise: number;
    productSubtotalPaise: number;
    deliveryFeePaise: number;
    handlingFeePaise: number;
    taxPaise: number;
    decisionReasons: string[];
    selectedStrategyDetails: BasketStrategyResult;
  }): RunRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE runs
      SET status = ?,
          strategy_type = ?,
          grand_total_paise = ?,
          product_subtotal_paise = ?,
          delivery_fee_paise = ?,
          handling_fee_paise = ?,
          tax_paise = ?,
          decision_reasons = ?,
          selected_strategy_details = ?,
          updated_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);
    const row = stmt.get(
      data.status,
      data.strategyType,
      data.grandTotalPaise,
      data.productSubtotalPaise,
      data.deliveryFeePaise,
      data.handlingFeePaise,
      data.taxPaise,
      JSON.stringify(data.decisionReasons),
      JSON.stringify(data.selectedStrategyDetails),
      now,
      userId,
      id
    ) as RunRow | undefined;
    if (!row) {
      throw new Error(`Run ${id} not found for user ${userId}`);
    }
    return rowToRun(row);
  }
}
