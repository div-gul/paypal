import Database from 'better-sqlite3';

type ApprovalType = 'brand_substitution' | 'emergency_run' | 'budget_cap_exceeded' | 'blocked_category';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  id: string;
  userId: string;
  runId: string | null;
  itemId: string | null;
  type: ApprovalType;
  status: ApprovalStatus;
  reason: string;
  decidedAt: string | null;
  createdAt: string;
}

interface ApprovalRow {
  id: string;
  user_id: string;
  run_id: string | null;
  item_id: string | null;
  type: ApprovalType;
  status: ApprovalStatus;
  reason: string;
  decided_at: string | null;
  created_at: string;
}

function rowToApproval(row: ApprovalRow): ApprovalRecord {
  return {
    id: row.id,
    userId: row.user_id,
    runId: row.run_id,
    itemId: row.item_id,
    type: row.type,
    status: row.status,
    reason: row.reason,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

export class ApprovalRepository {
  constructor(private db: Database.Database) {}

  create(userId: string, data: Omit<ApprovalRecord, 'userId' | 'createdAt' | 'decidedAt'>): ApprovalRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO approvals (id, user_id, run_id, item_id, type, status, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(
      data.id,
      userId,
      data.runId || null,
      data.itemId || null,
      data.type,
      data.status || 'pending',
      data.reason,
      now
    ) as ApprovalRow;

    return rowToApproval(row);
  }

  getPending(userId: string): ApprovalRecord[] {
    const stmt = this.db.prepare('SELECT * FROM approvals WHERE user_id = ? AND status = ? ORDER BY created_at DESC');
    const rows = stmt.all(userId, 'pending') as ApprovalRow[];
    return rows.map(rowToApproval);
  }

  updateStatus(userId: string, id: string, status: 'approved' | 'rejected'): ApprovalRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = ?, decided_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);

    const row = stmt.get(status, now, userId, id) as ApprovalRow | undefined;
    if (!row) {
      throw new Error(`Approval ${id} not found for user ${userId}`);
    }

    return rowToApproval(row);
  }
}
