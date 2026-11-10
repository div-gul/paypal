import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { closeDatabase, getDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { resetRateLimitStore } from '../middleware/rateLimit.js';

describe('delivery address management', () => {
  let server: http.Server;
  let baseUrl: string;
  let cookie: string;
  let otherCookie: string;

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    const now = new Date().toISOString();
    const insertUser = db.prepare('INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    insertUser.run('address-user-1', 'Address User', 'address1@example.test', 'user', now, now);
    insertUser.run('address-user-2', 'Other User', 'address2@example.test', 'user', now, now);
    const insertSession = db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
    const createSession = (userId: string) => {
      const token = randomBytes(24).toString('hex');
      insertSession.run(createHash('sha256').update(token).digest('hex'), userId, new Date(Date.now() + 60_000).toISOString(), now);
      return `shoppilot_session=${token}`;
    };
    cookie = createSession('address-user-1');
    otherCookie = createSession('address-user-2');
    await new Promise<void>(resolve => {
      server = createApp().listen(0, () => {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Test server did not start');
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
  });

  beforeEach(() => resetRateLimitStore());

  const validAddress = (overrides: Record<string, unknown> = {}) => ({
    fullName: 'Aarav Joshi', mobileNumber: '+91 9876543210', houseBuilding: 'Flat 3B',
    streetLocality: 'MG Road', landmark: '', city: 'Bengaluru', state: 'Karnataka',
    pinCode: '560001', label: 'Home', ...overrides,
  });

  const request = (path: string, method = 'GET', body?: unknown, session = cookie) => fetch(`${baseUrl}/api${path}`, {
    method, headers: { Cookie: session, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  it('supports manual address entry outside the catalog PIN and default changes', async () => {
    const firstResponse = await request('/addresses', 'POST', validAddress());
    expect(firstResponse.status).toBe(201);
    const first = (await firstResponse.json() as any).address;
    expect(first.pinCode).toBe('560001');
    expect(first.mobileNumber).toBe('9876543210');
    expect(first.isDefault).toBe(true);

    const secondResponse = await request('/addresses', 'POST', validAddress({ city: 'Pune', state: 'Maharashtra', pinCode: '411046', label: 'Work' }));
    const second = (await secondResponse.json() as any).address;
    expect(second.isDefault).toBe(false);
    const selectResponse = await request(`/addresses/${second.id}/default`, 'POST');
    expect((await selectResponse.json() as any).address.isDefault).toBe(true);
    const list = (await request('/addresses').then(response => response.json()) as any).addresses;
    expect(list.filter((address: any) => address.isDefault)).toHaveLength(1);
    expect(list.find((address: any) => address.isDefault).id).toBe(second.id);
  });

  it('rejects invalid mobile numbers and PIN codes and supports address edits', async () => {
    for (const invalid of [validAddress({ mobileNumber: '12345' }), validAddress({ pinCode: '41104' })]) {
      expect((await request('/addresses', 'POST', invalid)).status).toBe(400);
    }
    const existing = (await request('/addresses').then(response => response.json()) as any).addresses[0];
    const updated = await request(`/addresses/${existing.id}`, 'PUT', validAddress({ city: 'Mysuru', state: 'Karnataka' }));
    expect(updated.status).toBe(200);
    expect((await updated.json() as any).address.city).toBe('Mysuru');
  });

  it('isolates addresses by authenticated user and safely chooses a replacement default after deletion', async () => {
    const ownerList = (await request('/addresses').then(response => response.json()) as any).addresses;
    const owned = ownerList[0];
    expect((await request('/addresses', 'GET', undefined, otherCookie).then(response => response.json()) as any).addresses).toHaveLength(0);
    expect((await request(`/addresses/${owned.id}`, 'PUT', validAddress(), otherCookie)).status).toBe(404);
    expect((await request(`/addresses/${owned.id}`, 'DELETE', undefined, otherCookie)).status).toBe(404);

    const defaults = ownerList.filter((address: any) => address.isDefault);
    const deletingDefault = defaults[0];
    const remaining = ownerList.find((address: any) => address.id !== deletingDefault.id);
    await request(`/addresses/${deletingDefault.id}`, 'DELETE');
    const afterDelete = (await request('/addresses').then(response => response.json()) as any).addresses;
    expect(afterDelete).toHaveLength(ownerList.length - 1);
    expect(afterDelete.find((address: any) => address.id === remaining.id)?.isDefault).toBe(true);
  });

  it('reverse-geocodes only on the explicit endpoint and returns editable approximate fields', async () => {
    const originalFetch = globalThis.fetch;
    const geocoder = vi.fn(async () => new Response(JSON.stringify({ address: {
      house_number: '12', road: 'MG Road', city: 'Bengaluru', state: 'Karnataka', postcode: '560001',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', geocoder);
    try {
      const response = await originalFetch(`${baseUrl}/api/addresses/reverse-geocode`, {
        method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
      });
      expect(response.status).toBe(200);
      const result = await response.json() as any;
      expect(result.provider).toBe('OpenStreetMap Nominatim');
      expect(result.address.pinCode).toBe('560001');
      expect(result.address.mobileNumber).toBeUndefined();
      expect(geocoder).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });

  it('reports reverse-geocoding failures without preventing manual address entry', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async () => new Response('unavailable', { status: 503 }));
    try {
      const response = await originalFetch(`${baseUrl}/api/addresses/reverse-geocode`, {
        method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
      });
      expect(response.status).toBe(502);
    } finally { vi.unstubAllGlobals(); }
    expect((await request('/addresses', 'POST', validAddress({ city: 'Chennai', state: 'Tamil Nadu', pinCode: '600001' }))).status).toBe(201);
  });
});
