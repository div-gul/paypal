import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getDatabase, closeDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { evaluatePolicy } from '@shared/policy';
import { BasketStrategyResult, PantryItem, WeeklySchedulerConfig } from '@shared/types';
import http from 'http';

describe('Phase 4: Policy Enforcement & Checkout Flow', () => {
  let server: http.Server;
  let baseUrl: string;

  const mockStrategy: BasketStrategyResult = {
    type: 'STRATEGY_B_SINGLE_STORE',
    title: 'Single Store Consolidation',
    tag: 'Recommended',
    description: 'Consolidated order with Zepto',
    totalProductPaise: 120000,
    totalDeliveryFeePaise: 2000,
    totalHandlingFeePaise: 400,
    totalTaxPaise: 6000,
    totalDiscountPaise: 0,
    grandTotalPaise: 128400, // ₹1,284.00
    isRecommended: true,
    recommendationReason: 'Lowest fee',
    storesInvolvedCount: 1,
    storeBaskets: [
      {
        storeId: 'zepto',
        storeName: 'Zepto',
        productSubtotalPaise: 120000,
        deliveryFeePaise: 2000,
        handlingFeePaise: 400,
        taxPaise: 6000,
        discountsPaise: 0,
        minOrderShortfallPaise: 0,
        totalPaise: 128400,
        meetsMinOrder: true,
        minOrderThresholdPaise: 14900,
        items: [
          {
            pantryItemId: 'item-milk',
            quantity: 2,
            totalPaise: 13200,
            isSubstitution: false,
            product: {
              id: 'zp-milk-1',
              storeId: 'zepto',
              pantryItemId: 'item-milk',
              name: 'Amul Taaza Milk',
              brand: 'Amul',
              packageSize: '1 L',
              unit: 'L',
              pricePaise: 6600,
              mrpPaise: 7200,
              inStock: true,
              stockQuantity: 20,
              isExactBrandMatch: true,
            },
          },
        ],
      },
    ],
  };

  const samplePantry: PantryItem[] = [
    {
      id: 'item-milk',
      name: 'Fresh Toned Milk',
      category: 'Dairy',
      preferredBrand: 'Amul',
      preferredPackageSize: '1 L',
      unit: 'L',
      currentQuantity: 0.1,
      averageDailyConsumption: 0.5,
      minStockThreshold: 1.0,
      targetStock: 3.0,
      allowSubstitutions: true,
      requireApprovalForBrandChange: true,
      lastRestockedDate: '2026-10-21T08:00:00.000Z',
      stockoutDaysCount: 0,
    },
  ];

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db, 'demo-user');

    const app = createApp({ testAuth: true });
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3002;
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

  describe('Deterministic shared/policy.ts unit checks', () => {
    it('approves orders within all thresholds', () => {
      const policy: WeeklySchedulerConfig = {
        preferredShoppingDay: 2,
        shoppingFrequency: 'weekly',
        nextShoppingDate: '2026-10-27T10:00:00.000Z',
        emergencyRestockPreference: 'ask_approval',
        urgentThresholdDays: 3,
        perCycleBudgetPaise: 250000,
      };

      const result = evaluatePolicy({
        strategy: mockStrategy,
        policy: { ...policy, perOrderCapPaise: 150000 },
        pantryItems: samplePantry,
      });

      expect(result.decision).toBe('auto_approved');
      expect(result.canCheckout).toBe(true);
    });

    it('flags needs_approval if per-order cap is exceeded', () => {
      const result = evaluatePolicy({
        strategy: mockStrategy, // 128400 paise
        policy: {
          preferredShoppingDay: 2,
          shoppingFrequency: 'weekly',
          nextShoppingDate: '2026-10-27T10:00:00.000Z',
          emergencyRestockPreference: 'ask_approval',
          urgentThresholdDays: 3,
          perCycleBudgetPaise: 250000,
          perOrderCapPaise: 100000, // Cap at ₹1,000 < ₹1,284
        },
        pantryItems: samplePantry,
      });

      expect(result.decision).toBe('needs_approval');
      expect(result.canCheckout).toBe(false);
      expect(result.reasons.some(r => r.includes('spending cap'))).toBe(true);
    });

    it('hard blocks order if containing an item from a blocked category', () => {
      const result = evaluatePolicy({
        strategy: mockStrategy,
        policy: {
          preferredShoppingDay: 2,
          shoppingFrequency: 'weekly',
          nextShoppingDate: '2026-10-27T10:00:00.000Z',
          emergencyRestockPreference: 'ask_approval',
          urgentThresholdDays: 3,
          perCycleBudgetPaise: 250000,
          blockedCategories: ['Dairy'], // Milk is Dairy!
        },
        pantryItems: samplePantry,
      });

      expect(result.decision).toBe('blocked');
      expect(result.canCheckout).toBe(false);
      expect(result.reasons[0]).toContain('restricted category');
    });

    it('requires approval if brand substitution is used', () => {
      const subStrategy = {
        ...mockStrategy,
        storeBaskets: [
          {
            ...mockStrategy.storeBaskets[0],
            items: [
              {
                ...mockStrategy.storeBaskets[0].items[0],
                isSubstitution: true, // Brand substitution!
              },
            ],
          },
        ],
      };

      const result = evaluatePolicy({
        strategy: subStrategy,
        policy: {
          preferredShoppingDay: 2,
          shoppingFrequency: 'weekly',
          nextShoppingDate: '2026-10-27T10:00:00.000Z',
          emergencyRestockPreference: 'ask_approval',
          urgentThresholdDays: 3,
          perCycleBudgetPaise: 250000,
          requireApprovalBrandSubstitution: true,
        },
        pantryItems: samplePantry,
      });

      expect(result.decision).toBe('needs_approval');
      expect(result.reasons.some(r => r.includes('Substitute brand'))).toBe(true);
    });
  });

  describe('Checkout API Endpoints & Server-Side Enforcement', () => {
    it('creates the payable run from the exact saved cart items and total', async () => {
      const response = await fetch(`${baseUrl}/api/runs/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ pantryItemId: 'item-milk', storeProductId: 'zp-milk-1', quantity: 1 }] }),
      });
      expect(response.status).toBe(201);
      const { run } = await response.json() as any;
      const detail = await fetch(`${baseUrl}/api/runs/${run.id}`);
      const detailData: any = await detail.json();
      expect(detailData.items).toHaveLength(1);
      expect(run.selectedStrategyDetails.storeBaskets.flatMap((basket: any) => basket.items)).toHaveLength(1);
      expect(run.grandTotalPaise).toBe(8600); // ₹66 product + ₹20 delivery
      expect(run.selectedStrategyDetails.grandTotalPaise).toBe(run.grandTotalPaise);
    });

    it('refuses to create a payable run from an empty cart', async () => {
      const response = await fetch(`${baseUrl}/api/runs/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      });
      expect(response.status).toBe(400);
    });

    it('refuses to create an order if run status is not approved or auto_approved', async () => {
      // 1. Plan a run
      const planRes = await fetch(`${baseUrl}/api/runs/plan`, { method: 'POST' });
      const planData: any = await planRes.json();
      const runId = planData.run.id;

      // If run needs approval, create-order should be rejected
      if (planData.run.status === 'needs_approval') {
        const orderRes = await fetch(`${baseUrl}/api/checkout/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId }),
        });

        expect(orderRes.status).toBe(403);
        const errData: any = await orderRes.json();
        expect(errData.error.code).toBe('APPROVAL_REQUIRED');
      }
    });

    it('creates order, captures atomically, restocks pantry, and is idempotent on repeat', async () => {
      // 1. Plan run
      const planRes = await fetch(`${baseUrl}/api/runs/plan`, { method: 'POST' });
      const planData: any = await planRes.json();
      const runId = planData.run.id;

      // Ensure approved if needed
      if (planData.run.status === 'needs_approval') {
        await fetch(`${baseUrl}/api/runs/${runId}/approve`, { method: 'POST' });
      }

      // 2. Create Order
      const createOrderRes = await fetch(`${baseUrl}/api/checkout/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      expect(createOrderRes.status).toBe(200);
      const orderData: any = await createOrderRes.json();
      expect(orderData.orderId).toBeDefined();
      expect(orderData.run.status).toBe('payment_pending');

      const orderId = orderData.orderId;

      // 3. Capture Order
      const captureRes = await fetch(`${baseUrl}/api/checkout/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, runId }),
      });
      expect(captureRes.status).toBe(200);
      const captureData: any = await captureRes.json();

      expect(captureData.success).toBe(true);
      expect(captureData.alreadyCaptured).toBe(false);
      expect(captureData.receipt.orderId).toBe(orderId);
      expect(captureData.run.status).toBe('paid');

      // Verify pantry restocked to target
      const pantryRes = await fetch(`${baseUrl}/api/pantry`);
      const pantryData: any = await pantryRes.json();
      const milk = pantryData.items.find((p: any) => p.id === 'item-milk');
      expect(milk.currentQuantity).toBeGreaterThanOrEqual(milk.targetStock);
      expect(milk.stockoutDaysCount).toBe(0);

      // Verify audit log has checkout_completed
      const auditRes = await fetch(`${baseUrl}/api/audit-log`);
      const auditData: any = await auditRes.json();
      expect(auditData.logs.some((l: any) => l.type === 'checkout_completed')).toBe(true);

      // 4. Capture twice is an idempotent no-op!
      const repeatCaptureRes = await fetch(`${baseUrl}/api/checkout/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, runId }),
      });
      expect(repeatCaptureRes.status).toBe(200);
      const repeatData: any = await repeatCaptureRes.json();
      expect(repeatData.alreadyCaptured).toBe(true);
      expect(repeatData.receipt.id).toBe(captureData.receipt.id);
    });
  });

  describe('POST /api/webhooks/paypal', () => {
    it('records and processes webhook events idempotently', async () => {
      const webhookPayload = {
        id: 'WH-EVT-SANDBOX-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAP-998877',
          status: 'COMPLETED',
        },
      };

      // First webhook post
      const firstRes = await fetch(`${baseUrl}/api/webhooks/paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paypal-transmission-id': 'WH-EVT-SANDBOX-001',
          'paypal-transmission-sig': 'sig_test_123',
        },
        body: JSON.stringify(webhookPayload),
      });

      expect(firstRes.status).toBe(200);
      const firstData: any = await firstRes.json();
      expect(firstData.received).toBe(true);
      expect(firstData.processed).toBe(true);

      // Repeat identical webhook post -> idempotent no-op
      const secondRes = await fetch(`${baseUrl}/api/webhooks/paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paypal-transmission-id': 'WH-EVT-SANDBOX-001',
          'paypal-transmission-sig': 'sig_test_123',
        },
        body: JSON.stringify(webhookPayload),
      });

      expect(secondRes.status).toBe(200);
      const secondData: any = await secondRes.json();
      expect(secondData.duplicate).toBe(true);
    });
  });
});
