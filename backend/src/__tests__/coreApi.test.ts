import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getDatabase, closeDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import http from 'http';

describe('Phase 3: Core API Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db, 'demo-user');

    const app = createApp();
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3001;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    const db = getDatabase();
    // Clean and re-seed database for pristine test isolation
    db.exec(`
      DELETE FROM receipts;
      DELETE FROM approvals;
      DELETE FROM run_items;
      DELETE FROM runs;
      DELETE FROM audit_log;
      DELETE FROM pantry_items;
      DELETE FROM policies;
      DELETE FROM sim_clock;
      DELETE FROM webhook_events;
    `);
    seedDatabase(db, 'demo-user');
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
  });

  it('GET /api/state returns complete state snapshot for demo-user', async () => {
    const res = await fetch(`${baseUrl}/api/state`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.pantry).toBeDefined();
    expect(data.pantry.length).toBe(8);
    expect(data.policy).toBeDefined();
    expect(data.clock).toBeDefined();
    expect(data.clock.daysElapsed).toBe(0);
    expect(data.recentAuditLog).toBeDefined();
    expect(data.recentAuditLog.length).toBeGreaterThan(0);
  });

  it('CRUD /api/pantry manages pantry items with Zod validation', async () => {
    // 1. Create
    const createRes = await fetch(`${baseUrl}/api/pantry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Organic Bananas',
        category: 'Fresh Produce',
        preferredBrand: 'FreshFarm',
        preferredPackageSize: '1 kg',
        unit: 'kg',
        currentQuantity: 1.5,
        averageDailyConsumption: 0.3,
        minStockThreshold: 1,
        targetStock: 3,
        allowSubstitutions: true,
        requireApprovalForBrandChange: false,
      }),
    });
    expect(createRes.status).toBe(201);
    const created: any = await createRes.json();
    expect(created.item.name).toBe('Organic Bananas');
    const itemId = created.item.id;

    // 2. Read single
    const getRes = await fetch(`${baseUrl}/api/pantry/${itemId}`);
    expect(getRes.status).toBe(200);
    const fetched: any = await getRes.json();
    expect(fetched.item.id).toBe(itemId);

    // 3. Update
    const updateRes = await fetch(`${baseUrl}/api/pantry/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentQuantity: 2.5,
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated: any = await updateRes.json();
    expect(updated.item.currentQuantity).toBe(2.5);

    // 4. Quick adjust delta
    const adjustRes = await fetch(`${baseUrl}/api/pantry/${itemId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: -0.5 }),
    });
    expect(adjustRes.status).toBe(200);
    const adjusted: any = await adjustRes.json();
    expect(adjusted.item.currentQuantity).toBe(2.0);

    // 5. Delete
    const deleteRes = await fetch(`${baseUrl}/api/pantry/${itemId}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const verifyRes = await fetch(`${baseUrl}/api/pantry/${itemId}`);
    expect(verifyRes.status).toBe(404);
  });

  it('GET /api/policy and PUT /api/policy update weekly scheduling and budget caps', async () => {
    const getRes = await fetch(`${baseUrl}/api/policy`);
    expect(getRes.status).toBe(200);
    const initial: any = await getRes.json();
    expect(initial.policy.perCycleBudgetPaise).toBe(350000);

    const updateRes = await fetch(`${baseUrl}/api/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        perCycleBudgetPaise: 300000,
        perOrderCapPaise: 200000,
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated: any = await updateRes.json();
    expect(updated.policy.perCycleBudgetPaise).toBe(300000);
    expect(updated.policy.perOrderCapPaise).toBe(200000);
  });

  it('POST /api/time/advance applies depletion and creates audit log entries', async () => {
    const advanceRes = await fetch(`${baseUrl}/api/time/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 1 }),
    });
    expect(advanceRes.status).toBe(200);
    const result: any = await advanceRes.json();

    expect(result.clock.daysElapsed).toBe(1);
    // Milk depleted by 0.5 from 0.6 -> 0.1
    const milk = result.pantry.find((p: any) => p.id === 'item-milk');
    expect(milk.currentQuantity).toBe(0.1);

    // Verify audit log has the advance entry
    const auditRes = await fetch(`${baseUrl}/api/audit-log`);
    const auditData: any = await auditRes.json();
    expect(auditData.logs.some((l: any) => l.type === 'time_advanced')).toBe(true);
  });

  it('GET /api/quotes returns store quotes with source tags', async () => {
    const res = await fetch(`${baseUrl}/api/quotes`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.quotes.length).toBeGreaterThan(0);
    expect(data.quotes[0].source).toBeDefined();
  }, 20000);

  it('POST /api/runs/plan generates run and enforces state machine transitions', async () => {
    // 1. Plan run
    const planRes = await fetch(`${baseUrl}/api/runs/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(planRes.status).toBe(201);
    const planData: any = await planRes.json();

    expect(planData.run).toBeDefined();
    expect(['auto_approved', 'needs_approval', 'blocked']).toContain(planData.run.status);
    expect(planData.strategies.length).toBeGreaterThanOrEqual(4);
    expect(planData.recommendedStrategy).toBeDefined();

    const runId = planData.run.id;

    // 2. Fetch run details
    const getRunRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    expect(getRunRes.status).toBe(200);
    const fetchedRun: any = await getRunRes.json();
    expect(fetchedRun.run.id).toBe(runId);
    expect(fetchedRun.items.length).toBeGreaterThan(0);

    // 3. Test approval state machine
    if (planData.run.status === 'needs_approval') {
      const approveRes = await fetch(`${baseUrl}/api/runs/${runId}/approve`, { method: 'POST' });
      expect(approveRes.status).toBe(200);
      const approvedData: any = await approveRes.json();
      expect(approvedData.run.status).toBe('approved');

      // Attempting to approve again is idempotent
      const doubleApproveRes = await fetch(`${baseUrl}/api/runs/${runId}/approve`, { method: 'POST' });
      expect(doubleApproveRes.status).toBe(200);
      const doubleData: any = await doubleApproveRes.json();
      expect(doubleData.run.status).toBe('approved');
    }
  });
});
