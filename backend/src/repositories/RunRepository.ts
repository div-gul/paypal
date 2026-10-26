import Database from 'better-sqlite3';
import { BasketStrategyResult, BasketStrategyType } from '@shared/types';

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
    simulatedDate: string;
  }): RunRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO runs (
        id, user_id, status, strategy_type, grand_total_paise,
        product_subtotal_paise, delivery_fee_paise, handling_fee_paise,
        tax_paise, discount_paise, decision_reasons,
        selected_strategy_details, simulated_date, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      SET status = ?, updated_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);
    const row = stmt.get(newStatus, now, userId, id) as RunRow | undefined;
    if (!row) {
      throw new Error(`Run ${id} not found for user ${userId}`);
    }
    return rowToRun(row);
  }
}
