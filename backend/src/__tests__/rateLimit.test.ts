import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { createApp } from '../app.js';
import { closeDatabase, getDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { resetRateLimitStore } from '../middleware/rateLimit.js';

describe('API abuse limits and body cap', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db, 'demo-user');
    server = createApp({ testAuth: true }).listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => resetRateLimitStore());
  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
  });

  it('limits failed login attempts and returns Retry-After', async () => {
    let last!: Response;
    for (let i = 0; i < 6; i++) {
      last = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' }),
      });
    }
    expect(last.status).toBe(429);
    expect(last.headers.get('retry-after')).toBeTruthy();
    expect((await last.json() as any).error.code).toBe('RATE_LIMITED');
  });

  it('limits AI requests per user', async () => {
    let last!: Response;
    for (let i = 0; i < 11; i++) {
      last = await fetch(`${baseUrl}/api/ai/parse-policy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Set my budget to 3000' }),
      });
    }
    expect(last.status).toBe(429);
    expect(last.headers.get('retry-after')).toBeTruthy();
    expect((await last.json() as any).error.code).toBe('RATE_LIMITED');
  });

  it('limits checkout order creation per user', async () => {
    let last!: Response;
    for (let i = 0; i < 11; i++) {
      last = await fetch(`${baseUrl}/api/checkout/create-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
    }
    expect(last.status).toBe(429);
    expect((await last.json() as any).error.code).toBe('RATE_LIMITED');
  });

  it('rejects request bodies larger than 100 KB', async () => {
    const response = await fetch(`${baseUrl}/api/state/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oversized: 'x'.repeat(110_000) }),
    });
    expect(response.status).toBe(413);
    expect((await response.json() as any).error.code).toBe('BODY_TOO_LARGE');
  });
});
