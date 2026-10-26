import Database from 'better-sqlite3';

export interface WebhookEventRecord {
  id: string;
  userId: string;
  eventType: string;
  resourceId: string | null;
  payloadJson: string;
  processed: boolean;
  processedAt: string | null;
  createdAt: string;
}

interface WebhookEventRow {
  id: string;
  user_id: string;
  event_type: string;
  resource_id: string | null;
  payload_json: string;
  processed: number;
  processed_at: string | null;
  created_at: string;
}

function rowToEvent(row: WebhookEventRow): WebhookEventRecord {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    resourceId: row.resource_id,
    payloadJson: row.payload_json,
    processed: Boolean(row.processed),
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

export class WebhookEventRepository {
  constructor(private db: Database.Database) {}

  recordEvent(event: {
    id: string;
    userId?: string;
    eventType: string;
    resourceId?: string;
    payloadJson: string;
  }): { recorded: boolean; event: WebhookEventRecord } {
    const existing = this.findById(event.id);
    if (existing) {
      return { recorded: false, event: existing };
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO webhook_events (id, user_id, event_type, resource_id, payload_json, processed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
      RETURNING *
    `);

    const row = stmt.get(
      event.id,
      event.userId || 'demo-user',
      event.eventType,
      event.resourceId || null,
      event.payloadJson,
      now
    ) as WebhookEventRow;

    return { recorded: true, event: rowToEvent(row) };
  }

  findById(id: string): WebhookEventRecord | null {
    const stmt = this.db.prepare('SELECT * FROM webhook_events WHERE id = ?');
    const row = stmt.get(id) as WebhookEventRow | undefined;
    return row ? rowToEvent(row) : null;
  }

  markProcessed(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE webhook_events SET processed = 1, processed_at = ? WHERE id = ?');
    stmt.run(now, id);
  }
}
