import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import {
  UserRepository,
  SimClockRepository,
  PantryRepository,
  PolicyRepository,
  RunRepository,
  RunItemRepository,
  ReceiptRepository,
  ApprovalRepository,
  AuditLogRepository,
  WebhookEventRepository,
} from '../repositories/index.js';

describe('Phase 2: Database Schema, Seed, and Repositories', () => {
  let db: Database.Database;

  beforeEach(() => {
    // In-memory SQLite database for test isolation
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('runs migrations and creates all required tables and indexes', () => {
    const tablesStmt = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    const tables = (tablesStmt.all() as { name: string }[]).map(t => t.name);

    const requiredTables = [
      'users',
      'sim_clock',
      'pantry_items',
      'policies',
      'runs',
      'run_items',
      'receipts',
      'approvals',
      'audit_log',
      'webhook_events',
    ];

    for (const table of requiredTables) {
      expect(tables).toContain(table);
    }

    // Verify user_id indexes
    const indexStmt = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%user_id%'
    `);
    const indexes = (indexStmt.all() as { name: string }[]).map(i => i.name);
    expect(indexes.length).toBeGreaterThanOrEqual(8);
  });

  it('seeds database idempotently with initial pantry items, clock, and policy', () => {
    seedDatabase(db, 'demo-user');

    const pantryRepo = new PantryRepository(db);
    const clockRepo = new SimClockRepository(db);
    const policyRepo = new PolicyRepository(db);
    const auditRepo = new AuditLogRepository(db);

    const items = pantryRepo.getAllByUserId('demo-user');
    expect(items.length).toBe(8); // 8 household items from frontend defaults

    const milk = pantryRepo.getById('demo-user', 'item-milk');
    expect(milk).toBeDefined();
    expect(milk?.name).toBe('Fresh Toned Milk');
    expect(milk?.currentQuantity).toBe(0.6);
    expect(milk?.averageDailyConsumption).toBe(0.5);

    const clock = clockRepo.getByUserId('demo-user');
    expect(clock).toBeDefined();
    expect(clock?.daysElapsed).toBe(0);

    const policy = policyRepo.getByUserId('demo-user');
    expect(policy).toBeDefined();
    expect(policy?.perCycleBudgetPaise).toBe(350000);
    expect(policy?.perOrderCapPaise).toBe(150000);

    const logs = auditRepo.getRecent('demo-user');
    expect(logs.length).toBeGreaterThanOrEqual(2);

    // Run seed again to verify idempotency
    seedDatabase(db, 'demo-user');
    const itemsSecondPass = pantryRepo.getAllByUserId('demo-user');
    expect(itemsSecondPass.length).toBe(8); // No duplicates
  });

  it('enforces user scoping across repositories', () => {
    seedDatabase(db, 'user-A');

    // Create user-B
    const userRepo = new UserRepository(db);
    userRepo.upsert({ id: 'user-B', name: 'User B', email: 'userb@test.com' });

    const pantryRepo = new PantryRepository(db);
    const userAItems = pantryRepo.getAllByUserId('user-A');
    expect(userAItems.length).toBe(8);

    const userBItems = pantryRepo.getAllByUserId('user-B');
    expect(userBItems.length).toBe(0); // user-B has no items

    // Add item for user-B
    pantryRepo.create('user-B', {
      id: 'item-apples',
      name: 'Red Apples',
      category: 'Fresh Produce',
      preferredBrand: 'FreshFarm',
      preferredPackageSize: '1 kg',
      unit: 'kg',
      currentQuantity: 2,
      averageDailyConsumption: 0.5,
      minStockThreshold: 1,
      targetStock: 3,
      allowSubstitutions: true,
      requireApprovalForBrandChange: false,
      lastRestockedDate: '2026-10-24T00:00:00.000Z',
    });

    expect(pantryRepo.getAllByUserId('user-B').length).toBe(1);
    expect(pantryRepo.getAllByUserId('user-A').length).toBe(8);
  });

  it('handles runs, items, approvals, receipts, and webhook idempotency', () => {
    seedDatabase(db, 'demo-user');

    const runRepo = new RunRepository(db);
    const runItemRepo = new RunItemRepository(db);
    const receiptRepo = new ReceiptRepository(db);
    const approvalRepo = new ApprovalRepository(db);
    const webhookRepo = new WebhookEventRepository(db);

    // 1. Create Run
    const run = runRepo.create('demo-user', {
      id: 'run-1',
      status: 'planned',
      strategyType: 'STRATEGY_B_SINGLE_STORE',
      grandTotalPaise: 49015,
      productSubtotalPaise: 42000,
      deliveryFeePaise: 2000,
      handlingFeePaise: 400,
      taxPaise: 2100,
      decisionReasons: ['Single store consolidation with Zepto'],
      simulatedDate: '2026-10-24T10:00:00.000Z',
    });
    expect(run.status).toBe('planned');

    // 2. Create Run Items
    runItemRepo.createBatch('demo-user', [
      {
        id: 'ri-1',
        runId: 'run-1',
        pantryItemId: 'item-milk',
        itemName: 'Fresh Toned Milk',
        storeId: 'zepto',
        storeProductId: 'zp-milk-1',
        quantity: 2,
        unitPricePaise: 6600,
        totalPricePaise: 13200,
        isSubstitution: false,
        isUrgent: true,
        outcome: 'RESTOCK_NOW',
        reasoning: 'Depleting in 1.2d',
        approvalStatus: 'approved',
      },
    ]);

    const items = runItemRepo.getByRunId('demo-user', 'run-1');
    expect(items.length).toBe(1);

    // 3. Approval lifecycle
    const approval = approvalRepo.create('demo-user', {
      id: 'appr-1',
      runId: 'run-1',
      itemId: 'item-milk',
      type: 'emergency_run',
      status: 'pending',
      reason: 'Urgent emergency order incurs delivery fee',
    });
    expect(approval.status).toBe('pending');
    expect(approvalRepo.getPending('demo-user').length).toBe(1);

    approvalRepo.updateStatus('demo-user', 'appr-1', 'approved');
    expect(approvalRepo.getPending('demo-user').length).toBe(0);

    // 4. Update Run to Paid and Create Receipt
    runRepo.updateStatus('demo-user', 'run-1', 'paid');
    const updatedRun = runRepo.getById('demo-user', 'run-1');
    expect(updatedRun?.status).toBe('paid');

    const receipt = receiptRepo.create('demo-user', {
      id: 'rcpt-1',
      runId: 'run-1',
      orderId: 'PAYPAL-TEST-999',
      amountPaise: 49015,
      currency: 'INR',
      paymentProvider: 'mock',
      itemsJson: JSON.stringify(items),
      breakdownJson: JSON.stringify({ subtotal: 42000, delivery: 2000 }),
      status: 'settled',
    });
    expect(receipt.orderId).toBe('PAYPAL-TEST-999');

    // 5. Webhook event idempotency
    const firstAttempt = webhookRepo.recordEvent({
      id: 'WH-EVENT-101',
      userId: 'demo-user',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      resourceId: 'PAYPAL-TEST-999',
      payloadJson: '{"status":"COMPLETED"}',
    });
    expect(firstAttempt.recorded).toBe(true);

    const secondAttempt = webhookRepo.recordEvent({
      id: 'WH-EVENT-101',
      userId: 'demo-user',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      resourceId: 'PAYPAL-TEST-999',
      payloadJson: '{"status":"COMPLETED"}',
    });
    expect(secondAttempt.recorded).toBe(false); // Idempotent!
  });
});
