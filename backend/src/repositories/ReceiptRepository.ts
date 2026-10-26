import Database from 'better-sqlite3';

export interface ReceiptRecord {
  id: string;
  userId: string;
  runId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  paymentProvider: 'mock' | 'paypal_sandbox';
  itemsJson: string;
  breakdownJson: string;
  status: 'settled' | 'refunded';
  createdAt: string;
}

interface ReceiptRow {
  id: string;
  user_id: string;
  run_id: string;
  order_id: string;
  amount_paise: number;
  currency: string;
  payment_provider: 'mock' | 'paypal_sandbox';
  items_json: string;
  breakdown_json: string;
  status: 'settled' | 'refunded';
  created_at: string;
}

function rowToReceipt(row: ReceiptRow): ReceiptRecord {
  return {
    id: row.id,
    userId: row.user_id,
    runId: row.run_id,
    orderId: row.order_id,
    amountPaise: row.amount_paise,
    currency: row.currency,
    paymentProvider: row.payment_provider,
    itemsJson: row.items_json,
    breakdownJson: row.breakdown_json,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class ReceiptRepository {
  constructor(private db: Database.Database) {}

  create(userId: string, data: Omit<ReceiptRecord, 'userId' | 'createdAt'>): ReceiptRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO receipts (
        id, user_id, run_id, order_id, amount_paise,
        currency, payment_provider, items_json, breakdown_json,
        status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(
      data.id,
      userId,
      data.runId,
      data.orderId,
      data.amountPaise,
      data.currency || 'INR',
      data.paymentProvider,
      data.itemsJson,
      data.breakdownJson,
      data.status || 'settled',
      now
    ) as ReceiptRow;

    return rowToReceipt(row);
  }

  findByOrderId(userId: string, orderId: string): ReceiptRecord | null {
    const stmt = this.db.prepare('SELECT * FROM receipts WHERE user_id = ? AND order_id = ?');
    const row = stmt.get(userId, orderId) as ReceiptRow | undefined;
    return row ? rowToReceipt(row) : null;
  }

  findByRunId(userId: string, runId: string): ReceiptRecord | null {
    const stmt = this.db.prepare('SELECT * FROM receipts WHERE user_id = ? AND run_id = ?');
    const row = stmt.get(userId, runId) as ReceiptRow | undefined;
    return row ? rowToReceipt(row) : null;
  }

  getAllByUserId(userId: string, limit: number = 20): ReceiptRecord[] {
    const stmt = this.db.prepare('SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(userId, limit) as ReceiptRow[];
    return rows.map(rowToReceipt);
  }
}
