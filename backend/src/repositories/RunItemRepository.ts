import Database from 'better-sqlite3';

export interface RunItemRecord {
  id: string;
  runId: string;
  userId: string;
  pantryItemId: string;
  itemName: string;
  storeId: string;
  storeProductId: string;
  quantity: number;
  unitPricePaise: number;
  totalPricePaise: number;
  isSubstitution: boolean;
  isUrgent: boolean;
  outcome: string;
  reasoning: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface RunItemRow {
  id: string;
  run_id: string;
  user_id: string;
  pantry_item_id: string;
  item_name: string;
  store_id: string;
  store_product_id: string;
  quantity: number;
  unit_price_paise: number;
  total_price_paise: number;
  is_substitution: number;
  is_urgent: number;
  outcome: string;
  reasoning: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

function rowToRunItem(row: RunItemRow): RunItemRecord {
  return {
    id: row.id,
    runId: row.run_id,
    userId: row.user_id,
    pantryItemId: row.pantry_item_id,
    itemName: row.item_name,
    storeId: row.store_id,
    storeProductId: row.store_product_id,
    quantity: row.quantity,
    unitPricePaise: row.unit_price_paise,
    totalPricePaise: row.total_price_paise,
    isSubstitution: Boolean(row.is_substitution),
    isUrgent: Boolean(row.is_urgent),
    outcome: row.outcome,
    reasoning: row.reasoning,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
  };
}

export class RunItemRepository {
  constructor(private db: Database.Database) {}

  createBatch(userId: string, items: Omit<RunItemRecord, 'userId' | 'createdAt'>[]): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO run_items (
        id, run_id, user_id, pantry_item_id, item_name,
        store_id, store_product_id, quantity, unit_price_paise,
        total_price_paise, is_substitution, is_urgent,
        outcome, reasoning, approval_status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const item of items) {
        stmt.run(
          item.id,
          item.runId,
          userId,
          item.pantryItemId,
          item.itemName,
          item.storeId,
          item.storeProductId,
          item.quantity,
          item.unitPricePaise,
          item.totalPricePaise,
          item.isSubstitution ? 1 : 0,
          item.isUrgent ? 1 : 0,
          item.outcome,
          item.reasoning,
          item.approvalStatus,
          now
        );
      }
    });

    tx();
  }

  getByRunId(userId: string, runId: string): RunItemRecord[] {
    const stmt = this.db.prepare('SELECT * FROM run_items WHERE user_id = ? AND run_id = ?');
    const rows = stmt.all(userId, runId) as RunItemRow[];
    return rows.map(rowToRunItem);
  }
}
