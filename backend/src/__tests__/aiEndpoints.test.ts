import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Server } from 'http';
import { createApp } from '../app';
import { getDatabase, closeDatabase } from '../db/connection';
import { runMigrations } from '../db/migrate';
import { seedDatabase } from '../db/seed';
import { StoreProduct } from '@shared/types';
import { LLMService } from '../services/ai/LLMService';

describe('Phase 5: AI Endpoints (Server-Side, Validated)', () => {
  let server: Server;
  let baseUrl: string;

  const mockCandidates: StoreProduct[] = [
    {
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
      source: 'mock',
    },
    {
      id: 'bl-milk-sub',
      storeId: 'blinkit',
      pantryItemId: 'item-milk',
      name: 'Mother Dairy Classic Milk',
      brand: 'Mother Dairy',
      packageSize: '1 L',
      unit: 'L',
      pricePaise: 6400,
      mrpPaise: 6800,
      inStock: true,
      stockQuantity: 15,
      isExactBrandMatch: false,
      source: 'mock',
    },
  ];

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db, 'demo-user');

    const app = createApp();
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3003;
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

  describe('POST /api/ai/parse-policy', () => {
    it('parses natural language budget, day, and category constraints into a structured proposal', async () => {
      const res = await fetch(`${baseUrl}/api/ai/parse-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Set my weekly budget to ₹3500, per order cap to 1200, change restock day to Friday, and block snacks.',
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.proposal).toBeDefined();

      const { proposal } = data;
      expect(proposal.perCycleBudgetPaise).toBe(350000);
      expect(proposal.perOrderCapPaise).toBe(120000);
      expect(proposal.preferredShoppingDay).toBe(5); // Friday
      expect(proposal.blockedCategories).toContain('Snacks');
      expect(proposal.changesSummary.length).toBeGreaterThanOrEqual(3);
      expect(proposal.explanation).toContain('3,500');

      // CRITICAL: Ensure database policy was NOT changed automatically (proposal requires user review)
      const policyRes = await fetch(`${baseUrl}/api/policy`);
      const policyData: any = await policyRes.json();
      expect(policyData.policy.perCycleBudgetPaise).not.toBe(350000);
    });

    it('rejects empty prompts with 400 validation error', async () => {
      const res = await fetch(`${baseUrl}/api/ai/parse-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: ' ' }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/ai/substitute', () => {
    it('selects preferred brand if in-stock, with confidence and reasoning', async () => {
      const res = await fetch(`${baseUrl}/api/ai/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pantryItemId: 'item-milk',
          itemName: 'Fresh Toned Milk',
          preferredBrand: 'Amul',
          candidates: mockCandidates,
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.substitute).toBeDefined();

      const { substitute } = data;
      expect(substitute.selectedProductId).toBe('zp-milk-1');
      expect(substitute.brand).toBe('Amul');
      expect(substitute.confidence).toBeGreaterThan(0.9);
      expect(substitute.reasoning).toContain('Amul');
    });

    it('selects lowest-cost in-stock alternative if preferred brand is unavailable', async () => {
      const res = await fetch(`${baseUrl}/api/ai/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pantryItemId: 'item-milk',
          itemName: 'Fresh Toned Milk',
          preferredBrand: 'Nandini', // Not in candidates
          candidates: mockCandidates,
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      const { substitute } = data;

      // Should choose the lowest cost in-stock candidate (Mother Dairy @ 6400 paise)
      expect(substitute.selectedProductId).toBe('bl-milk-sub');
      expect(substitute.brand).toBe('Mother Dairy');
      expect(substitute.pricePaise).toBe(6400);
      expect(substitute.reasoning).toBeDefined();
    });

    it('rejects hallucinated product IDs and falls back strictly to server candidate list', async () => {
      const service = new LLMService();

      // Test unit selection with custom candidates
      const result = await service.selectSubstitute({
        pantryItemId: 'item-milk',
        itemName: 'Fresh Toned Milk',
        preferredBrand: 'UnavailableBrand',
        candidates: mockCandidates,
      });

      // Ensure the chosen product ID is guaranteed to be one of the mock candidate IDs
      const validIds = mockCandidates.map(c => c.id);
      expect(validIds).toContain(result.selectedProductId);
    });

    it('returns 400 when candidate list is empty', async () => {
      const res = await fetch(`${baseUrl}/api/ai/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pantryItemId: 'item-milk',
          itemName: 'Fresh Toned Milk',
          preferredBrand: 'Amul',
          candidates: [],
        }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
