import Database from 'better-sqlite3';
import { ActivityLogItem } from '@shared/types';

interface AuditLogRow {
  id: string;
  user_id: string;
  timestamp: string;
  simulated_date: string;
  type: ActivityLogItem['type'];
  title: string;
  description: string;
  status_badge: string | null;
  badge_color: ActivityLogItem['badgeColor'] | null;
  metadata: string | null;
}

function rowToLog(row: AuditLogRow): ActivityLogItem {
  return {
    id: row.id,
    timestamp: row.timestamp,
    simulatedDate: row.simulated_date,
    type: row.type,
    title: row.title,
    description: row.description,
    statusBadge: row.status_badge || undefined,
    badgeColor: row.badge_color || 'blue',
  };
}

export class AuditLogRepository {
  constructor(private db: Database.Database) {}

  create(userId: string, item: ActivityLogItem & { metadata?: Record<string, unknown> }): ActivityLogItem {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (
        id, user_id, timestamp, simulated_date, type,
        title, description, status_badge, badge_color, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(
      item.id,
      userId,
      item.timestamp || new Date().toISOString(),
      item.simulatedDate,
      item.type,
      item.title,
      item.description,
      item.statusBadge || null,
      item.badgeColor || 'blue',
      item.metadata ? JSON.stringify(item.metadata) : null
    ) as AuditLogRow;

    return rowToLog(row);
  }

  getRecent(userId: string, limit: number = 50): ActivityLogItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(userId, limit) as AuditLogRow[];
    return rows.map(rowToLog);
  }
}
