import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closeDatabase, getDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { AuthService } from '../services/AuthService.js';
import http from 'node:http';

const PASSWORD = 'Local_user@2026';
let baseUrl = '';
let server: http.Server;

function cookieFrom(response: Response): string {
  const value = response.headers.get('set-cookie');
  if (!value) throw new Error('Expected authentication cookie');
  return value.split(';', 1)[0];
}

async function register(name: string, email: string) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: PASSWORD }),
  });
  return { response, cookie: response.ok ? cookieFrom(response) : '' };
}

async function login(email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { response, cookie: response.ok ? cookieFrom(response) : '' };
}

describe('cookie authentication, isolation, and guest simulation permissions', () => {
  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db);
    new AuthService(db).seedGuest();
    server = createApp({ testAuth: false }).listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
  });

  it('registers an empty account, persists its cookie session, and rejects duplicate email', async () => {
    const { response, cookie } = await register('Alice', 'alice@example.com');
    expect(response.status).toBe(201);
    const body = await response.json() as { user: { id: string; role: string } };
    const { user } = body;
    expect(user.role).toBe('user');
    expect(JSON.stringify(body)).not.toContain('password_hash');
    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect((await me.json() as any).user.id).toBe(user.id);

    const db = getDatabase();
    expect((db.prepare('SELECT COUNT(*) AS n FROM pantry_items WHERE user_id = ?').get(user.id) as any).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM policies WHERE user_id = ?').get(user.id) as any).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM runs WHERE user_id = ?').get(user.id) as any).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM approvals WHERE user_id = ?').get(user.id) as any).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE user_id = ?').get(user.id) as any).n).toBe(0);

    const snapshot = await fetch(`${baseUrl}/api/state`, { headers: { Cookie: cookie } }).then(r => r.json()) as any;
    expect(snapshot.pantry).toEqual([]);
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.recentAuditLog).toEqual([]);
    expect((db.prepare('SELECT COUNT(*) AS n FROM policies WHERE user_id = ?').get(user.id) as any).n).toBe(0);

    const duplicate = await register('Alice Again', 'ALICE@example.com');
    expect(duplicate.response.status).toBe(409);
  });

  it('rejects bad credentials and invalidates the session on logout', async () => {
    expect((await login('alice@example.com', 'Wrong_pass@2026')).response.status).toBe(401);
    const { response, cookie } = await login('alice@example.com', PASSWORD);
    expect(response.status).toBe(200);
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
    expect(logout.status).toBe(204);
    expect((await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it('keeps two users’ pantry records isolated and blocks non-guest simulation routes', async () => {
    const alice = await register('Alice', 'alice2@example.com');
    const bob = await register('Bob', 'bob@example.com');
    const add = (cookie: string, name: string) => fetch(`${baseUrl}/api/pantry`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: 'Fresh Produce', preferredBrand: 'Local', preferredPackageSize: '1 kg', unit: 'kg', currentQuantity: 1, averageDailyConsumption: 0.1, minStockThreshold: 0.5, targetStock: 2 }),
    });
    expect((await add(alice.cookie, 'Alice Apples')).status).toBe(201);
    expect((await add(bob.cookie, 'Bob Bananas')).status).toBe(201);
    const aliceItems = await fetch(`${baseUrl}/api/pantry`, { headers: { Cookie: alice.cookie } }).then(r => r.json()) as any;
    const bobItems = await fetch(`${baseUrl}/api/pantry`, { headers: { Cookie: bob.cookie } }).then(r => r.json()) as any;
    expect(aliceItems.items.map((item: any) => item.name)).toEqual(['Alice Apples']);
    expect(bobItems.items.map((item: any) => item.name)).toEqual(['Bob Bananas']);
    const savedBasket = { status: 'draft', items: [{ pantryItemId: 'alice-item', quantity: 2 }] };
    expect((await fetch(`${baseUrl}/api/workspace`, {
      method: 'PUT', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upcomingOrder: savedBasket, swapDecisions: { 'alice-item': 'approved' } }),
    })).status).toBe(200);
    const aliceWorkspace = await fetch(`${baseUrl}/api/workspace`, { headers: { Cookie: alice.cookie } }).then(r => r.json()) as any;
    const bobWorkspace = await fetch(`${baseUrl}/api/workspace`, { headers: { Cookie: bob.cookie } }).then(r => r.json()) as any;
    expect(aliceWorkspace.upcomingOrder).toEqual(savedBasket);
    expect(aliceWorkspace.swapDecisions).toEqual({ 'alice-item': 'approved' });
    expect(bobWorkspace).toEqual({ upcomingOrder: null, swapDecisions: {} });
    const aliceId = aliceItems.items[0].id;
    expect((await fetch(`${baseUrl}/api/pantry/${aliceId}`, { headers: { Cookie: bob.cookie } })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/time`, { headers: { Cookie: alice.cookie } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/time/advance`, { method: 'POST', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 1 }) })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/state/reset`, { method: 'POST', headers: { Cookie: alice.cookie } })).status).toBe(403);
    const planned = await fetch(`${baseUrl}/api/runs/plan`, { method: 'POST', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' }, body: '{}' });
    expect(planned.status).toBe(201);
    const aliceRunId = (await planned.json() as any).run.id;
    const aliceRuns = await fetch(`${baseUrl}/api/runs`, { headers: { Cookie: alice.cookie } }).then(r => r.json()) as any;
    const bobRuns = await fetch(`${baseUrl}/api/runs`, { headers: { Cookie: bob.cookie } }).then(r => r.json()) as any;
    expect(aliceRuns.runs.map((run: any) => run.id)).toContain(aliceRunId);
    expect(bobRuns.runs).toEqual([]);
    expect((await fetch(`${baseUrl}/api/runs/${aliceRunId}`, { headers: { Cookie: bob.cookie } })).status).toBe(404);
  });

  it('logs in the seeded guest and allows its simulation controls', async () => {
    const { response, cookie } = await login('guest_paypal@example.com', 'GUEST_paypal@1502');
    expect(response.status).toBe(200);
    expect((await response.json() as any).user.role).toBe('guest');
    const guestId = (getDatabase().prepare('SELECT id FROM users WHERE email = ?').get('guest_paypal@example.com') as any).id;
    const pantryBefore = (getDatabase().prepare('SELECT COUNT(*) AS n FROM pantry_items WHERE user_id = ?').get(guestId) as any).n;
    expect(pantryBefore).toBeGreaterThan(0);
    new AuthService(getDatabase()).seedGuest();
    new AuthService(getDatabase()).seedGuest();
    expect((getDatabase().prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get('guest_paypal@example.com') as any).n).toBe(1);
    expect((getDatabase().prepare('SELECT COUNT(*) AS n FROM pantry_items WHERE user_id = ?').get(guestId) as any).n).toBe(pantryBefore);
    const advance = await fetch(`${baseUrl}/api/time/advance`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 1 }),
    });
    expect(advance.status).toBe(200);
  });

  it('requires authentication for user data APIs', async () => {
    expect((await fetch(`${baseUrl}/api/pantry`)).status).toBe(401);
  });
});
