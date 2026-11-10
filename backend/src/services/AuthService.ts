import Database from 'better-sqlite3';
import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';

const SESSION_DAYS = 7;
const GUEST_EMAIL = 'guest_paypal@example.com';
const GUEST_PASSWORD = 'GUEST_paypal@1502';
const DUMMY_PASSWORD_HASH = hashPassword('unused-dummy-password-value');

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'guest';
  hasPassword?: boolean;
  createdAt?: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, saltHex, hashHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createSession(db: Database.Database, user: PublicUser): { token: string; expiresAt: string } {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO auth_sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), user.id, expiresAt, new Date().toISOString());
  return { token, expiresAt };
}

export class AuthService {
  constructor(private db: Database.Database) {}

  register(input: { name: string; email: string; password: string }): void {
    const email = input.email.trim().toLowerCase();
    const passwordHash = hashPassword(input.password);
    if (email === GUEST_EMAIL) return;
    if (this.db.prepare('SELECT 1 FROM users WHERE LOWER(email) = ?').get(email)) {
      return;
    }
    const userId = randomUUID();
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('INSERT INTO users(id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, input.name.trim(), email, passwordHash, 'user', now, now);
      this.db.prepare('INSERT INTO sim_clock(user_id, simulated_date, days_elapsed, cycle_count, updated_at) VALUES (?, ?, 0, 1, ?)')
        .run(userId, now, now);
    });
    try {
      tx();
    } catch (error) {
      if ((error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return;
      }
      throw error;
    }
  }

  login(emailInput: string, password: string) {
    const row = this.db.prepare('SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = ?')
      .get(emailInput.trim().toLowerCase()) as (PublicUser & { password_hash: string | null }) | undefined;
    const passwordIsValid = verifyPassword(password, row?.password_hash || DUMMY_PASSWORD_HASH);
    if (!row?.password_hash || !passwordIsValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    }
    if (row.role === 'guest' && process.env.NODE_ENV === 'production') {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    }
    const user: PublicUser = { id: row.id, name: row.name, email: row.email, role: row.role, hasPassword: true };
    this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id);
    return { user, ...createSession(this.db, user) };
  }

  loginWithGoogle(input: { email: string; name: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, created_at AS createdAt FROM users WHERE LOWER(email) = ?')
      .get(email) as any;

    if (existing) {
      const publicUser: PublicUser = {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        hasPassword: Boolean(existing.hasPassword),
        createdAt: existing.createdAt,
      };
      return { user: publicUser, ...createSession(this.db, publicUser) };
    }

    const user: PublicUser = {
      id: randomUUID(),
      name: input.name?.trim() || email.split('@')[0],
      email,
      role: 'user',
      hasPassword: false,
    };
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('INSERT INTO users(id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(user.id, user.name, user.email, null, user.role, now, now);
      this.db.prepare('INSERT INTO sim_clock(user_id, simulated_date, days_elapsed, cycle_count, updated_at) VALUES (?, ?, 0, 1, ?)')
        .run(user.id, now, now);
      return createSession(this.db, user);
    });

    try {
      return { user, ...tx() };
    } catch (error) {
      if ((error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const fallback = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, created_at AS createdAt FROM users WHERE LOWER(email) = ?')
          .get(email) as any;
        const publicFallback: PublicUser = {
          id: fallback.id,
          name: fallback.name,
          email: fallback.email,
          role: fallback.role,
          hasPassword: Boolean(fallback.hasPassword),
          createdAt: fallback.createdAt,
        };
        return { user: publicFallback, ...createSession(this.db, publicFallback) };
      }
      throw error;
    }
  }

  logout(token: string | undefined): void {
    if (!token) return;
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .run(createHash('sha256').update(token).digest('hex'));
  }

  updateProfile(userId: string, input: { name?: string; currentPassword?: string; newPassword?: string }): PublicUser {
    const userRow = this.db.prepare('SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = ?')
      .get(userId) as { id: string; name: string; email: string; password_hash: string | null; role: 'user' | 'guest'; created_at: string } | undefined;

    if (!userRow) {
      throw new AppError('NOT_FOUND', 'User not found.', 404);
    }

    let newPasswordHash: string | null = null;
    if (input.newPassword) {
      if (userRow.password_hash) {
        if (!input.currentPassword || !verifyPassword(input.currentPassword, userRow.password_hash)) {
          throw new AppError('INVALID_PASSWORD', 'Current password is incorrect.', 400);
        }
      }
      newPasswordHash = hashPassword(input.newPassword);
    }

    const updatedName = input.name?.trim() ? input.name.trim() : userRow.name;
    const now = new Date().toISOString();

    if (newPasswordHash) {
      this.db.prepare('UPDATE users SET name = ?, password_hash = ?, updated_at = ? WHERE id = ?')
        .run(updatedName, newPasswordHash, now, userId);
    } else {
      this.db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?')
        .run(updatedName, now, userId);
    }

    const updatedRow = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, created_at AS createdAt FROM users WHERE id = ?')
      .get(userId) as any;

    return {
      id: updatedRow.id,
      name: updatedRow.name,
      email: updatedRow.email,
      role: updatedRow.role,
      hasPassword: Boolean(updatedRow.hasPassword),
      createdAt: updatedRow.createdAt,
    };
  }

  deleteAccount(userId: string): void {
    const userRow = this.db.prepare('SELECT id, email, role FROM users WHERE id = ?')
      .get(userId) as { id: string; email: string; role: 'user' | 'guest' } | undefined;

    if (!userRow) {
      throw new AppError('NOT_FOUND', 'User not found.', 404);
    }

    if (userRow.role === 'guest' || userRow.email.toLowerCase() === GUEST_EMAIL.toLowerCase()) {
      throw new AppError('FORBIDDEN', 'The demo guest account cannot be deleted.', 403);
    }

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM user_workspace WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM sim_clock WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM pantry_items WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM policies WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM run_items WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM receipts WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM approvals WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM runs WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM audit_log WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });

    tx();
  }

  createPasswordReset(email: string): { resetToken: string; user: { name: string; email: string } } | null {
    const normalized = email.trim().toLowerCase();
    if (normalized === GUEST_EMAIL.toLowerCase()) return null;

    const user = this.db.prepare('SELECT id, name, email, role FROM users WHERE LOWER(email) = ?')
      .get(normalized) as { id: string; name: string; email: string; role: 'user' | 'guest' } | undefined;

    if (!user || user.role === 'guest') return null;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare('INSERT INTO password_resets(id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, user.id, tokenHash, expiresAt, now);

    return { resetToken: rawToken, user: { name: user.name, email: user.email } };
  }

  resetPassword(token: string, newPassword: string): void {
    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
    const now = new Date().toISOString();

    const record = this.db.prepare(`
      SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at
      FROM password_resets pr
      WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ?
    `).get(tokenHash, now) as { id: string; user_id: string } | undefined;

    if (!record) {
      throw new AppError('INVALID_TOKEN', 'This password reset link is invalid or has expired.', 400);
    }

    const passwordHash = hashPassword(newPassword);

    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(passwordHash, now, record.user_id);
      this.db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?')
        .run(now, record.id);
      this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?')
        .run(record.user_id);
    });

    tx();
  }

  seedGuest(): void {
    const now = new Date().toISOString();
    const guest = this.db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(GUEST_EMAIL) as { id: string } | undefined;
    const legacy = this.db.prepare("SELECT id FROM users WHERE id = 'demo-user'").get() as { id: string } | undefined;
    if (guest) {
      this.db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'guest', updated_at = ? WHERE id = ?")
        .run('Guest Household', hashPassword(GUEST_PASSWORD), now, guest.id);
      return;
    }
    if (legacy) {
      this.db.prepare("UPDATE users SET name = ?, email = ?, password_hash = ?, role = 'guest', updated_at = ? WHERE id = ?")
        .run('Guest Household', GUEST_EMAIL, hashPassword(GUEST_PASSWORD), now, legacy.id);
      return;
    }
    const id = 'guest-user';
    this.db.prepare("INSERT INTO users(id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'guest', ?, ?)")
      .run(id, 'Guest Household', GUEST_EMAIL, hashPassword(GUEST_PASSWORD), now, now);
  }
}
