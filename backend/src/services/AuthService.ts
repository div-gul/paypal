import Database from 'better-sqlite3';
import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/errorHandler.js';
import { DeliveryAddressRepository } from '../repositories/DeliveryAddressRepository.js';
import { seedDatabase } from '../db/seed.js';

const SESSION_DAYS = 7;
const GUEST_EMAIL = 'guest_paypal@example.com';
const GUEST_PASSWORD = 'GUEST_paypal@1502';
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
const DUMMY_PASSWORD_HASH = hashPassword('unused-dummy-password-value');

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'guest';
  hasPassword?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, encoded: string): boolean {
  if (!encoded) return false;

  // Modern bcrypt hash check ($2a$, $2b$, $2y$)
  if (encoded.startsWith('$2a$') || encoded.startsWith('$2b$') || encoded.startsWith('$2y$')) {
    return bcrypt.compareSync(password, encoded);
  }

  // Safe migration / backward compatibility: verify legacy scrypt format
  const [algorithm, saltHex, hashHex] = encoded.split('$');
  if (algorithm === 'scrypt' && saltHex && hashHex) {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  return false;
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

  register(input: { name: string; email: string; password: string }): { verificationToken: string; user: { id: string; name: string; email: string } } | null {
    const email = input.email.trim().toLowerCase();
    const passwordHash = hashPassword(input.password);
    if (email === GUEST_EMAIL) return null;
    if (this.db.prepare('SELECT 1 FROM users WHERE LOWER(email) = ?').get(email)) {
      return null;
    }
    const userId = randomUUID();
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('INSERT INTO users(id, name, email, password_hash, role, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
        .run(userId, input.name.trim(), email, passwordHash, 'user', now, now);
      this.db.prepare('INSERT INTO sim_clock(user_id, simulated_date, days_elapsed, cycle_count, updated_at) VALUES (?, ?, 0, 1, ?)')
        .run(userId, now, now);
    });
    try {
      tx();
      const verification = this.createEmailVerification(userId);
      return {
        verificationToken: verification.verificationToken,
        user: { id: userId, name: input.name.trim(), email },
      };
    } catch (error) {
      if ((error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return null;
      }
      throw error;
    }
  }

  login(emailInput: string, password: string) {
    const row = this.db.prepare('SELECT id, name, email, password_hash, role, (email_verified = 1) AS emailVerified, created_at AS createdAt FROM users WHERE LOWER(email) = ?')
      .get(emailInput.trim().toLowerCase()) as (PublicUser & { password_hash: string | null; emailVerified?: number }) | undefined;
    const passwordIsValid = verifyPassword(password, row?.password_hash || DUMMY_PASSWORD_HASH);
    if (!row?.password_hash || !passwordIsValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    }
    const isDemoAllowed = process.env.DEMO_MODE === 'true' || Boolean(process.env.RENDER) || Boolean(process.env.RENDER_EXTERNAL_URL);
    if (row.role === 'guest' && process.env.NODE_ENV === 'production' && !isDemoAllowed) {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    }

    // Transparent rehash-on-login: upgrade legacy scrypt hash to bcrypt
    if (row.password_hash.startsWith('scrypt$')) {
      const upgradedHash = hashPassword(password);
      this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgradedHash, row.id);
    }

    const user: PublicUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      hasPassword: true,
      emailVerified: Boolean(row.emailVerified),
      createdAt: row.createdAt,
    };
    this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id);
    return { user, ...createSession(this.db, user) };
  }

  loginWithGoogle(input: { email: string; name: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, (email_verified = 1) AS emailVerified, created_at AS createdAt FROM users WHERE LOWER(email) = ?')
      .get(email) as any;

    if (existing) {
      // Ensure Google users have email_verified = 1
      if (!existing.emailVerified) {
        this.db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(existing.id);
      }
      const publicUser: PublicUser = {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        hasPassword: Boolean(existing.hasPassword),
        emailVerified: true,
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
      emailVerified: true,
    };
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('INSERT INTO users(id, name, email, password_hash, role, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
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
          emailVerified: true,
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
    const userRow = this.db.prepare('SELECT id, name, email, password_hash, role, (email_verified = 1) AS emailVerified, created_at FROM users WHERE id = ?')
      .get(userId) as { id: string; name: string; email: string; password_hash: string | null; role: 'user' | 'guest'; emailVerified?: number; created_at: string } | undefined;

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

    const updatedRow = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, (email_verified = 1) AS emailVerified, created_at AS createdAt FROM users WHERE id = ?')
      .get(userId) as any;

    return {
      id: updatedRow.id,
      name: updatedRow.name,
      email: updatedRow.email,
      role: updatedRow.role,
      hasPassword: Boolean(updatedRow.hasPassword),
      emailVerified: Boolean(updatedRow.emailVerified),
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
      this.db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM user_workspace WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM sim_clock WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM pantry_items WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM policies WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM run_items WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM receipts WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM approvals WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM runs WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM audit_log WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM webhook_events WHERE user_id = ?').run(userId);
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

  createEmailVerification(userId: string): { verificationToken: string; user: { name: string; email: string } } {
    const user = this.db.prepare('SELECT id, name, email FROM users WHERE id = ?')
      .get(userId) as { id: string; name: string; email: string } | undefined;

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found.', 404);
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare('INSERT INTO email_verifications(id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, user.id, tokenHash, expiresAt, now);

    return { verificationToken: rawToken, user: { name: user.name, email: user.email } };
  }

  verifyEmail(token: string): { user: PublicUser } {
    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
    const now = new Date().toISOString();

    const record = this.db.prepare(`
      SELECT ev.id, ev.user_id, ev.expires_at, ev.used_at
      FROM email_verifications ev
      WHERE ev.token_hash = ? AND ev.used_at IS NULL AND ev.expires_at > ?
    `).get(tokenHash, now) as { id: string; user_id: string } | undefined;

    if (!record) {
      throw new AppError('INVALID_TOKEN', 'This email verification link is invalid or has expired.', 400);
    }

    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE email_verifications SET used_at = ? WHERE id = ?').run(now, record.id);
      this.db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(now, record.user_id);
    });
    tx();

    const updated = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, (email_verified = 1) AS emailVerified, created_at AS createdAt FROM users WHERE id = ?')
      .get(record.user_id) as any;

    return {
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        hasPassword: Boolean(updated.hasPassword),
        emailVerified: true,
        createdAt: updated.createdAt,
      },
    };
  }

  exportUserData(userId: string) {
    const user = this.db.prepare('SELECT id, name, email, role, (password_hash IS NOT NULL) AS hasPassword, (email_verified = 1) AS emailVerified, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?')
      .get(userId) as any;
    if (!user) throw new AppError('NOT_FOUND', 'User not found.', 404);

    const pantry = this.db.prepare('SELECT * FROM pantry_items WHERE user_id = ?').all(userId);
    const deliveryAddresses = new DeliveryAddressRepository(this.db).list(userId);
    const policy = this.db.prepare('SELECT * FROM policies WHERE user_id = ?').get(userId);
    const runs = this.db.prepare('SELECT * FROM runs WHERE user_id = ?').all(userId);
    const runItems = this.db.prepare('SELECT * FROM run_items WHERE user_id = ?').all(userId);
    const receipts = this.db.prepare('SELECT * FROM receipts WHERE user_id = ?').all(userId);
    const approvals = this.db.prepare('SELECT * FROM approvals WHERE user_id = ?').all(userId);
    const auditLog = this.db.prepare('SELECT * FROM audit_log WHERE user_id = ?').all(userId);
    const clock = this.db.prepare('SELECT * FROM sim_clock WHERE user_id = ?').get(userId);
    const workspace = this.db.prepare('SELECT * FROM user_workspace WHERE user_id = ?').get(userId);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasPassword: Boolean(user.hasPassword),
        emailVerified: Boolean(user.emailVerified),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      pantry,
      deliveryAddresses,
      policy,
      runs: runs.map((run: any) => ({
        ...run,
        items: runItems.filter((item: any) => item.run_id === run.id),
      })),
      receipts,
      approvals,
      activity: auditLog,
      clock,
      workspace: workspace ? {
        upcomingOrderJson: (workspace as any).upcoming_order_json,
        swapDecisionsJson: (workspace as any).swap_decisions_json,
        updatedAt: (workspace as any).updated_at,
      } : null,
    };
  }

  seedGuest(): void {
    const now = new Date().toISOString();
    const guest = this.db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(GUEST_EMAIL) as { id: string } | undefined;
    const legacy = this.db.prepare("SELECT id FROM users WHERE id = 'demo-user'").get() as { id: string } | undefined;
    if (guest) {
      this.db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'guest', email_verified = 1, updated_at = ? WHERE id = ?")
        .run('Guest Household', hashPassword(GUEST_PASSWORD), now, guest.id);
      seedDatabase(this.db, guest.id);
      return;
    } else if (legacy) {
      this.db.prepare("UPDATE users SET name = ?, email = ?, password_hash = ?, role = 'guest', email_verified = 1, updated_at = ? WHERE id = ?")
        .run('Guest Household', GUEST_EMAIL, hashPassword(GUEST_PASSWORD), now, legacy.id);
      seedDatabase(this.db, legacy.id);
      return;
    } else {
      const id = 'guest-user';
      this.db.prepare("INSERT INTO users(id, name, email, password_hash, role, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 'guest', 1, ?, ?)")
        .run(id, 'Guest Household', GUEST_EMAIL, hashPassword(GUEST_PASSWORD), now, now);
      seedDatabase(this.db, id);
    }
  }
}
