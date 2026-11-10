import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { createApp } from '../app.js';
import { closeDatabase, getDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { resetRateLimitStore } from '../middleware/rateLimit.js';

const PASSWORD = 'SecurityCheck@2026';
let server: http.Server;
let baseUrl = '';
let authenticatedCookie = '';
let secondAuthenticatedCookie = '';

function forwardedIp(ip: string): Record<string, string> {
  // The test app trusts one proxy hop; this header simulates the trusted proxy's client IP.
  return { 'X-Forwarded-For': ip };
}

describe('unauthenticated protected API rate limit', () => {
  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db, 'demo-user');
    server = createApp().listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;

    const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `rate-limit-${tag}@example.test`;
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rate Limit Test', email, password: PASSWORD }),
    });
    if (registration.status !== 202) throw new Error('Could not register rate-limit test account');
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!login.ok) throw new Error('Could not authenticate rate-limit test account');
    authenticatedCookie = login.headers.get('set-cookie')?.split(';', 1)[0] || '';
    if (!authenticatedCookie) throw new Error('Expected a session cookie');

    const secondEmail = `rate-limit-second-${tag}@example.test`;
    const secondRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second Rate Limit Test', email: secondEmail, password: PASSWORD }),
    });
    if (secondRegistration.status !== 202) throw new Error('Could not register second rate-limit test account');
    const secondLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: secondEmail, password: PASSWORD }),
    });
    if (!secondLogin.ok) throw new Error('Could not authenticate second rate-limit test account');
    secondAuthenticatedCookie = secondLogin.headers.get('set-cookie')?.split(';', 1)[0] || '';
    if (!secondAuthenticatedCookie) throw new Error('Expected a second session cookie');
  });

  beforeEach(() => resetRateLimitStore());
  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
  });

  it('returns 429 after 60 unauthenticated protected requests from one IP', async () => {
    const headers = forwardedIp('198.51.100.10');
    for (let i = 0; i < 60; i++) {
      const response = await fetch(`${baseUrl}/api/state`, { headers });
      expect(response.status).toBe(401);
    }
    const limited = await fetch(`${baseUrl}/api/state`, { headers });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect((await limited.json() as any).error.code).toBe('RATE_LIMITED');
  });

  it('also protects the authenticated /api/auth/me route', async () => {
    const headers = forwardedIp('198.51.100.17');
    for (let i = 0; i < 60; i++) {
      const response = await fetch(`${baseUrl}/api/auth/me`, { headers });
      expect(response.status).toBe(401);
    }
    const limited = await fetch(`${baseUrl}/api/auth/me`, { headers });
    expect(limited.status).toBe(429);
  });

  it('keeps anonymous counters independent for different IPs', async () => {
    const saturatedIp = forwardedIp('198.51.100.11');
    for (let i = 0; i < 61; i++) await fetch(`${baseUrl}/api/state`, { headers: saturatedIp });

    const otherIp = await fetch(`${baseUrl}/api/state`, { headers: forwardedIp('198.51.100.12') });
    expect(otherIp.status).toBe(401);
  });

  it('does not count authenticated requests against the IP limit or change per-user limits', async () => {
    const ip = '198.51.100.13';
    for (let i = 0; i < 61; i++) {
      const response = await fetch(`${baseUrl}/api/state`, {
        headers: { ...forwardedIp(ip), Cookie: authenticatedCookie },
      });
      expect(response.status).toBe(200);
    }
    for (let i = 0; i < 61; i++) {
      const response = await fetch(`${baseUrl}/api/state`, {
        headers: { ...forwardedIp(ip), Cookie: secondAuthenticatedCookie },
      });
      expect(response.status).toBe(200);
    }

    for (let i = 0; i < 60; i++) {
      const response = await fetch(`${baseUrl}/api/state`, { headers: forwardedIp(ip) });
      expect(response.status).toBe(401);
    }
    const limited = await fetch(`${baseUrl}/api/state`, { headers: forwardedIp(ip) });
    expect(limited.status).toBe(429);
  });

  it('preserves signup and webhook IP limits', async () => {
    const signupHeaders = { ...forwardedIp('198.51.100.14'), 'Content-Type': 'application/json' };
    let signupResponse!: Response;
    for (let i = 0; i < 6; i++) {
      signupResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST', headers: signupHeaders,
        body: JSON.stringify({ name: 'Signup Limit', email: `signup-limit-${i}@example.test`, password: PASSWORD }),
      });
    }
    expect(signupResponse.status).toBe(429);

    const webhookHeaders = { ...forwardedIp('198.51.100.15'), 'Content-Type': 'application/json' };
    let webhookResponse!: Response;
    for (let i = 0; i < 301; i++) {
      webhookResponse = await fetch(`${baseUrl}/api/webhooks/paypal`, {
        method: 'POST', headers: webhookHeaders,
        body: JSON.stringify({ id: `webhook-rate-${i}`, event_type: 'PAYMENT.UNKNOWN', resource: {} }),
      });
    }
    expect(webhookResponse.status).toBe(429);
  });
});
