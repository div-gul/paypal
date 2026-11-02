import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '../app.js';
import { getDatabase, closeDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { PantryRepository } from '../repositories/PantryRepository.js';
import { config } from '../config.js';
import http from 'http';

describe('PayPal Webhooks & Signature Verification', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db);

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

  afterAll(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    closeDatabase();
  });

  beforeEach(() => {
    const db = getDatabase();
    seedDatabase(db);
    vi.restoreAllMocks();
  });

  it('allows webhook without signature headers when in mock mode or webhook ID unset', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'WH-TEST-MOCK-001',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: 'ORD-123' },
      }),
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.received).toBe(true);
    expect(data.processed).toBe(true);
  });

  it('handles duplicate webhook event idempotently without processing twice', async () => {
    const payload = {
      id: 'WH-DUP-001',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: { id: 'ORD-DUP' },
    };

    // First delivery
    const res1 = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(200);

    // Second delivery (duplicate)
    const res2 = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(200);
    const data2: any = await res2.json();
    expect(data2.duplicate).toBe(true);
  });

  it('settles restock run atomically upon receiving PAYMENT.CAPTURE.COMPLETED', async () => {
    const db = getDatabase();
    const runRepo = new RunRepository(db);
    const pantryRepo = new PantryRepository(db);

    // 1. Create a restock run waiting for payment
    const run = runRepo.create('demo-user', {
      id: 'run-webhook-settle-1',
      status: 'payment_pending',
      strategyType: 'STRATEGY_B_SINGLE_STORE',
      grandTotalPaise: 8500,
      productSubtotalPaise: 8000,
      deliveryFeePaise: 500,
      handlingFeePaise: 0,
      taxPaise: 0,
      decisionReasons: ['Replenishment run for webhook testing'],
      simulatedDate: '2026-11-02T10:00:00Z',
      orderId: 'ORDER-WH-12345',
    });

    expect(run.status).toBe('payment_pending');

    // 2. Deliver PAYMENT.CAPTURE.COMPLETED
    const res = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'WH-CAPTURE-COMPLETED-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAP-WH-999',
          supplementary_data: {
            related_ids: {
              order_id: 'ORDER-WH-12345',
            },
          },
          amount: {
            currency_code: 'USD',
            value: '1.00',
          },
          payer: {
            email_address: 'webhook-buyer@example.com',
          },
        },
      }),
    });

    expect(res.status).toBe(200);

    // 3. Verify run transitioned to 'paid'
    const updatedRun = runRepo.getById('demo-user', 'run-webhook-settle-1');
    expect(updatedRun!.status).toBe('paid');

    // 4. Verify receipt created
    const { ReceiptRepository } = await import('../repositories/ReceiptRepository.js');
    const receiptRepo = new ReceiptRepository(db);
    const receipt = receiptRepo.findByOrderId('demo-user', 'ORDER-WH-12345');
    expect(receipt).not.toBeNull();
    expect(receipt!.paypalCaptureId).toBe('CAP-WH-999');
    expect(receipt!.payerEmail).toBe('webhook-buyer@example.com');
  });

  it('marks restock run as "failed" upon receiving PAYMENT.CAPTURE.DENIED', async () => {
    const db = getDatabase();
    const runRepo = new RunRepository(db);
    const pantryRepo = new PantryRepository(db);

    // Record milk level before
    const milkBefore = pantryRepo.getById('demo-user', 'item-milk');
    const originalMilkQty = milkBefore!.currentQuantity;

    // Create a restock run
    runRepo.create('demo-user', {
      id: 'run-webhook-denied-1',
      status: 'payment_pending',
      strategyType: 'STRATEGY_B_SINGLE_STORE',
      grandTotalPaise: 8500,
      productSubtotalPaise: 8000,
      deliveryFeePaise: 500,
      handlingFeePaise: 0,
      taxPaise: 0,
      decisionReasons: ['Replenishment run for denial testing'],
      simulatedDate: '2026-11-02T10:00:00Z',
      orderId: 'ORDER-WH-DENIED',
    });

    // Deliver PAYMENT.CAPTURE.DENIED
    const res = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'WH-CAPTURE-DENIED-001',
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'CAP-DENIED-123',
          supplementary_data: {
            related_ids: {
              order_id: 'ORDER-WH-DENIED',
            },
          },
          status_details: {
            reason: 'INSUFFICIENT_FUNDS',
          },
        },
      }),
    });

    expect(res.status).toBe(200);

    // Verify run is marked 'failed'
    const failedRun = runRepo.getById('demo-user', 'run-webhook-denied-1');
    expect(failedRun!.status).toBe('failed');

    // Verify pantry stock was NOT touched
    const milkAfter = pantryRepo.getById('demo-user', 'item-milk');
    expect(milkAfter!.currentQuantity).toBe(originalMilkQty);

    // Verify audit log has checkout_failed
    const auditRes = await fetch(`${baseUrl}/api/audit-log`);
    const auditData: any = await auditRes.json();
    expect(auditData.logs.some((l: any) => l.type === 'checkout_failed')).toBe(true);
  });

  it('rejects with 401 when signature verification fails in sandbox mode with webhook ID', async () => {
    const originalMode = config.PAYPAL_MODE;
    const originalWebhookId = config.PAYPAL_WEBHOOK_ID;

    // Configure sandbox mode with active webhook ID for this test
    (config as any).PAYPAL_MODE = 'sandbox';
    (config as any).PAYPAL_WEBHOOK_ID = 'WH-TEST-WEBHOOK-ID';

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'fake-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/v1/notifications/verify-webhook-signature')) {
        return new Response(JSON.stringify({ verification_status: 'FAILURE' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url as any);
    });

    try {
      const res = await originalFetch(`${baseUrl}/api/webhooks/paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paypal-transmission-id': 'trans-123',
          'paypal-transmission-time': '2026-11-02T10:00:00Z',
          'paypal-transmission-sig': 'sig-bad',
          'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: JSON.stringify({
          id: 'WH-SIG-FAIL-001',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'CAP-123' },
        }),
      });

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error.code).toBe('INVALID_SIGNATURE');
    } finally {
      (config as any).PAYPAL_MODE = originalMode;
      (config as any).PAYPAL_WEBHOOK_ID = originalWebhookId;
      global.fetch = originalFetch;
    }
  });

  it('accepts and processes event when signature verification succeeds in sandbox mode', async () => {
    const originalMode = config.PAYPAL_MODE;
    const originalWebhookId = config.PAYPAL_WEBHOOK_ID;

    (config as any).PAYPAL_MODE = 'sandbox';
    (config as any).PAYPAL_WEBHOOK_ID = 'WH-TEST-WEBHOOK-ID';

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'fake-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/v1/notifications/verify-webhook-signature')) {
        return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url as any);
    });

    try {
      const res = await originalFetch(`${baseUrl}/api/webhooks/paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paypal-transmission-id': 'trans-valid-123',
          'paypal-transmission-time': '2026-11-02T10:00:00Z',
          'paypal-transmission-sig': 'sig-valid',
          'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: JSON.stringify({
          id: 'WH-SIG-SUCCESS-001',
          event_type: 'CHECKOUT.ORDER.APPROVED',
          resource: { id: 'ORD-OK' },
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.processed).toBe(true);
    } finally {
      (config as any).PAYPAL_MODE = originalMode;
      (config as any).PAYPAL_WEBHOOK_ID = originalWebhookId;
      global.fetch = originalFetch;
    }
  });
});
