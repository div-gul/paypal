import Database from 'better-sqlite3';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  constructor(private db: Database.Database) {}

  findById(id: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return (stmt.get(id) as UserRecord) || null;
  }

  upsert(user: { id: string; name: string; email: string }): UserRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, name, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        updated_at = excluded.updated_at
      RETURNING *
    `);
    return stmt.get(user.id, user.name, user.email, now, now) as UserRecord;
  }
}
