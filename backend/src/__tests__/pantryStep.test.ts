import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { getDatabase, closeDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import http from 'http';

describe('Pantry Quantity Steps, Fractions & Validation', () => {
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

  it('seed data configures quantityStep and allowFractions accurately', async () => {
    const res = await fetch(`${baseUrl}/api/pantry`);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    const items = data.items;

    const eggs = items.find((i: any) => i.id === 'item-3' || i.name.toLowerCase().includes('egg'));
    const bread = items.find((i: any) => i.id === 'item-2' || i.name.toLowerCase().includes('bread'));
    const milk = items.find((i: any) => i.id === 'item-1' || i.name.toLowerCase().includes('milk'));
    const coffee = items.find((i: any) => i.id === 'item-5' || i.name.toLowerCase().includes('coffee'));
    const oats = items.find((i: any) => i.id === 'item-4' || i.name.toLowerCase().includes('oats'));

    expect(eggs.quantityStep).toBe(1);
    expect(eggs.allowFractions).toBe(false);

    expect(bread.quantityStep).toBe(1);
    expect(bread.allowFractions).toBe(false);

    expect(milk.quantityStep).toBe(0.5);
    expect(milk.allowFractions).toBe(true);

    expect(coffee.quantityStep).toBe(1);
    expect(coffee.allowFractions).toBe(false);

    expect(oats.quantityStep).toBe(0.5);
    expect(oats.allowFractions).toBe(true);
  });

  it('whole-number adjust works for eggs (+1 and -1)', async () => {
    // 1. Fetch eggs item
    const getRes = await fetch(`${baseUrl}/api/pantry/item-eggs`);
    expect(getRes.status).toBe(200);
    const { item: initialEggs } = await getRes.json();
    const initialQty = initialEggs.currentQuantity;

    // 2. Adjust +1
    const addRes = await fetch(`${baseUrl}/api/pantry/item-eggs/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: 1 }),
    });
    expect(addRes.status).toBe(200);
    const addData: any = await addRes.json();
    expect(addData.item.currentQuantity).toBe(initialQty + 1);

    // 3. Adjust -1
    const subRes = await fetch(`${baseUrl}/api/pantry/item-eggs/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: -1 }),
    });
    expect(subRes.status).toBe(200);
    const subData: any = await subRes.json();
    expect(subData.item.currentQuantity).toBe(initialQty);
  });

  it('fractional adjust is rejected for eggs (allowFractions=false) with standard error', async () => {
    const res = await fetch(`${baseUrl}/api/pantry/item-eggs/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: 0.5 }),
    });

    expect(res.status).toBe(400);
    const errorBody: any = await res.json();
    expect(errorBody.error).toBeDefined();
    expect(errorBody.error.code).toBe('INVALID_QUANTITY_STEP');
    expect(errorBody.error.message).toContain('Quantity adjustment delta 0.5 must be a multiple');
  });

  it('fractional adjust (+0.5 and -0.5) works for milk (allowFractions=true, step=0.5)', async () => {
    const getRes = await fetch(`${baseUrl}/api/pantry/item-milk`);
    expect(getRes.status).toBe(200);
    const { item: initialMilk } = await getRes.json();
    const initialQty = initialMilk.currentQuantity;

    // +0.5
    const addRes = await fetch(`${baseUrl}/api/pantry/item-milk/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: 0.5 }),
    });
    expect(addRes.status).toBe(200);
    const addData: any = await addRes.json();
    expect(addData.item.currentQuantity).toBe(initialQty + 0.5);

    // -0.5
    const subRes = await fetch(`${baseUrl}/api/pantry/item-milk/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: -0.5 }),
    });
    expect(subRes.status).toBe(200);
    const subData: any = await subRes.json();
    expect(subData.item.currentQuantity).toBe(initialQty);
  });

  it('clamps at 0 on large negative adjustment', async () => {
    const res = await fetch(`${baseUrl}/api/pantry/item-eggs/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: -50 }),
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.item.currentQuantity).toBe(0);
  });

  it('validates currentQuantity, targetStock, and minStockThreshold on item creation and update', async () => {
    // 1. Invalid fractional currentQuantity for countable unit "pcs"
    const invalidCreate = await fetch(`${baseUrl}/api/pantry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Organic Apples',
        category: 'Fresh Produce',
        preferredBrand: 'Farm Fresh',
        preferredPackageSize: '1 pc',
        unit: 'pcs',
        currentQuantity: 2.5, // Not allowed for pcs (step 1, allowFractions false)
        averageDailyConsumption: 0.5,
        minStockThreshold: 2,
        targetStock: 5,
      }),
    });
    expect(invalidCreate.status).toBe(400);
    const errData: any = await invalidCreate.json();
    expect(errData.error.code).toBe('INVALID_QUANTITY_STEP');

    // 2. Valid creation
    const validCreate = await fetch(`${baseUrl}/api/pantry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Organic Apples',
        category: 'Fresh Produce',
        preferredBrand: 'Farm Fresh',
        preferredPackageSize: '1 pc',
        unit: 'pcs',
        currentQuantity: 3,
        averageDailyConsumption: 0.5,
        minStockThreshold: 2,
        targetStock: 6,
      }),
    });
    expect(validCreate.status).toBe(201);
    const { item: createdItem } = await validCreate.json();
    expect(createdItem.quantityStep).toBe(1);
    expect(createdItem.allowFractions).toBe(false);

    // 3. Invalid update with fractional targetStock
    const invalidUpdate = await fetch(`${baseUrl}/api/pantry/${createdItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetStock: 5.5,
      }),
    });
    expect(invalidUpdate.status).toBe(400);
    const updateErr: any = await invalidUpdate.json();
    expect(updateErr.error.code).toBe('INVALID_QUANTITY_STEP');
  });

  it('keeps precise fractional stock during time advance, and restock recommendation is whole number for countable items', async () => {
    // Advance simulation clock by 1 day
    const advanceRes = await fetch(`${baseUrl}/api/time/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 1 }),
    });
    expect(advanceRes.status).toBe(200);

    const pantryRes = await fetch(`${baseUrl}/api/pantry/item-milk`);
    expect(pantryRes.status).toBe(200);
    const { item: milkItem } = await pantryRes.json();
    // Milk daily consumption is 0.5 L/day, initial 0.6 -> 0.1 L
    expect(milkItem.currentQuantity).toBeCloseTo(0.1, 2);

    // Bread is countable, consumption is 0.5 packs/day, initial 1 -> 0.5 internally
    const breadRes = await fetch(`${baseUrl}/api/pantry/item-bread`);
    expect(breadRes.status).toBe(200);
    const { item: breadItem } = await breadRes.json();
    expect(breadItem.currentQuantity).toBe(0.5);

    // Floor display test (as done on frontend)
    const displayedQty = breadItem.allowFractions ? breadItem.currentQuantity : Math.floor(breadItem.currentQuantity);
    expect(displayedQty).toBe(0);

    // Plan run & test restock recommendation quantities
    const planRes = await fetch(`${baseUrl}/api/runs/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(planRes.status).toBe(201);
    const planData: any = await planRes.json();

    // Check all countable recommendations have integer recommendedQuantity
    const recommendations = planData.recommendations || [];
    for (const rec of recommendations) {
      if (rec.allowFractions === false) {
        expect(Number.isInteger(rec.recommendedQuantity)).toBe(true);
      }
    }
  });
});
