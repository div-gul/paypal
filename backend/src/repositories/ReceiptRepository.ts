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
  paypalCaptureId?: string | null;
  usdAmount?: string | null;
  usdRate?: number | null;
  inrPaise?: number | null;
  payerEmail?: string | null;
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
  paypal_capture_id?: string | null;
  usd_amount?: string | null;
  usd_rate?: number | null;
  inr_paise?: number | null;
  payer_email?: string | null;
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
    paypalCaptureId: row.paypal_capture_id || null,
    usdAmount: row.usd_amount || null,
    usdRate: row.usd_rate ?? null,
    inrPaise: row.inr_paise ?? row.amount_paise,
    payerEmail: row.payer_email || null,
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
        status, paypal_capture_id, usd_amount, usd_rate, inr_paise, payer_email,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.paypalCaptureId || null,
      data.usdAmount || null,
      data.usdRate || null,
      data.inrPaise ?? data.amountPaise,
      data.payerEmail || null,
      now
    ) as ReceiptRow;

    return rowToReceipt(row);
  }

  findByOrderId(userId: string, orderId: string): ReceiptRecord | null {
    const stmt = this.db.prepare(
      'SELECT * FROM receipts WHERE user_id = ? AND (order_id = ? OR paypal_capture_id = ?) LIMIT 1'
    );
    const row = stmt.get(userId, orderId, orderId) as ReceiptRow | undefined;
    return row ? rowToReceipt(row) : null;
  }

  findByRunId(userId: string, runId: string): ReceiptRecord | null {
    const stmt = this.db.prepare('SELECT * FROM receipts WHERE user_id = ? AND run_id = ? LIMIT 1');
    const row = stmt.get(userId, runId) as ReceiptRow | undefined;
    return row ? rowToReceipt(row) : null;
  }

  getAllByUserId(userId: string, limit: number = 20): ReceiptRecord[] {
    const stmt = this.db.prepare('SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(userId, limit) as ReceiptRow[];
    return rows.map(rowToReceipt);
  }
}
