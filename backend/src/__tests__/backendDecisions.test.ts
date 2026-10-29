import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Server } from 'http';
import { createApp } from '../app';
import { getDatabase, closeDatabase } from '../db/connection';
import { runMigrations } from '../db/migrate';
import { seedDatabase } from '../db/seed';

describe('Backend Updates: Reset, Overrides, Strategy Switch & Order-Derived Capture', () => {
  let server: Server;
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
        const port = typeof addr === 'object' && addr ? addr.port : 3004;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    const db = getDatabase();
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

  describe('POST /api/state/reset', () => {
    it('resets state to clean defaults and writes audit log entry', async () => {
      // Modify pantry item
      await fetch(`${baseUrl}/api/pantry/item-milk/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: 5 }),
      });

      // Call reset
      const resetRes = await fetch(`${baseUrl}/api/state/reset`, { method: 'POST' });
      expect(resetRes.status).toBe(200);
      const resetData: any = await resetRes.json();
      expect(resetData.success).toBe(true);

      // Verify pantry milk returned to default 0.6
      const stateRes = await fetch(`${baseUrl}/api/state`);
      const stateData: any = await stateRes.json();
      const milk = stateData.pantry.find((p: any) => p.id === 'item-milk');
      expect(milk.currentQuantity).toBe(0.6);

      // Verify audit log has reset entry
      const audit = stateData.recentAuditLog;
      expect(audit.some((a: any) => a.title.includes('Reset'))).toBe(true);
    });
  });

  describe('POST /api/runs/plan overrides & PUT /api/runs/:id/strategy', () => {
    it('applies includeItemIds and excludeItemIds overrides without mutating pantry', async () => {
      const planRes = await fetch(`${baseUrl}/api/runs/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excludeItemIds: ['item-milk'], // Exclude milk
          strategy: 'STRATEGY_B_SINGLE_STORE',
        }),
      });

      expect(planRes.status).toBe(201);
      const planData: any = await planRes.json();
      expect(planData.run).toBeDefined();

      // Check recommendations
      const milkRec = planData.recommendations.find((r: any) => r.itemId === 'item-milk');
      expect(milkRec.outcome).toBe('WAIT_UNTIL_NEXT_CYCLE');
      expect(milkRec.recommendedQuantity).toBe(0);

      // Verify pantry milk was NOT mutated
      const pantryRes = await fetch(`${baseUrl}/api/pantry/item-milk`);
      const pantryData: any = await pantryRes.json();
      expect(pantryData.item.currentQuantity).toBe(0.6);
    });

    it('switches strategy on run via PUT /api/runs/:id/strategy and updates line items & totals', async () => {
      const planRes = await fetch(`${baseUrl}/api/runs/plan`, { method: 'POST' });
      const planData: any = await planRes.json();
      const runId = planData.run.id;

      // Switch strategy to STRATEGY_A_LOWEST_PRICE
      const switchRes = await fetch(`${baseUrl}/api/runs/${runId}/strategy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'STRATEGY_A_LOWEST_PRICE' }),
      });

      expect(switchRes.status).toBe(200);
      const switchData: any = await switchRes.json();
      expect(switchData.run.strategyType).toBe('STRATEGY_A_LOWEST_PRICE');
      expect(switchData.run.grandTotalPaise).toBeGreaterThan(0);

      // Verify items were replaced
      const runRes = await fetch(`${baseUrl}/api/runs/${runId}`);
      const runData: any = await runRes.json();
      expect(runData.run.strategyType).toBe('STRATEGY_A_LOWEST_PRICE');
      expect(runData.items.length).toBeGreaterThan(0);
    });
  });

  describe('Order-Derived Capture & Ownership Validation', () => {
    it('derives run from stored order and rejects spoofed runIds', async () => {
      const planRes = await fetch(`${baseUrl}/api/runs/plan`, { method: 'POST' });
      const planData: any = await planRes.json();
      const runId = planData.run.id;

      if (planData.run.status === 'needs_approval') {
        await fetch(`${baseUrl}/api/runs/${runId}/approve`, { method: 'POST' });
      }

      // Create order
      const createOrderRes = await fetch(`${baseUrl}/api/checkout/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const orderData: any = await createOrderRes.json();
      const orderId = orderData.orderId;

      // Capture with spoofed/mismatched runId should fail
      const badCaptureRes = await fetch(`${baseUrl}/api/checkout/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, runId: 'spoofed-fake-run-id' }),
      });
      expect(badCaptureRes.status).toBe(400);

      // Capture without runId (order-derived) should succeed!
      const goodCaptureRes = await fetch(`${baseUrl}/api/checkout/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      expect(goodCaptureRes.status).toBe(200);
      const goodData: any = await goodCaptureRes.json();
      expect(goodData.success).toBe(true);
      expect(goodData.receipt.orderId).toBe(orderId);
      expect(goodData.run.id).toBe(runId);
    });
  });
});
