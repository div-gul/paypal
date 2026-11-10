import Database from 'better-sqlite3';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closeDatabase, getDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { DEMO_SERVICE_AREA, SEEDED_PRODUCT_CATALOG, SEEDED_PRODUCT_GROUP_COUNT, seedProductCatalog } from '../db/productCatalog.js';
import { ProductCatalogRepository } from '../repositories/ProductCatalogRepository.js';

describe('seeded product catalog', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    closeDatabase();
    const db = getDatabase(':memory:');
    runMigrations(db);
    seedProductCatalog(db);
    const app = createApp({ testAuth: true });
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
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

  it('stores 33 product groups and 88 unique offers across all three platforms and can be seeded repeatedly', () => {
    const db = getDatabase();
    const repository = new ProductCatalogRepository(db);
    const products = repository.list();
    expect(SEEDED_PRODUCT_GROUP_COUNT).toBe(33);
    expect(SEEDED_PRODUCT_CATALOG).toHaveLength(88);
    expect(repository.count()).toBe(88);
    expect(new Set(products.map(product => product.id)).size).toBe(88);
    expect(new Set(products.map(product => product.productGroupId)).size).toBe(33);
    expect(new Set(repository.list().map(product => product.platform))).toEqual(new Set(['blinkit', 'zepto', 'instamart']));
    expect(new Set(products.map(product => product.pinCode))).toEqual(new Set([DEMO_SERVICE_AREA.pinCode]));
    expect(products.filter(product => product.platform === 'blinkit')).toHaveLength(29);
    expect(products.filter(product => product.platform === 'zepto')).toHaveLength(30);
    expect(products.filter(product => product.platform === 'instamart')).toHaveLength(29);
    const productOffers = products.map(product => `${product.name}|${product.brand}|${product.packageSize}|${product.platform}`);
    expect(new Set(productOffers).size).toBe(88);
    expect(new Set(products.map(product => product.category))).toContain('Fresh Produce');

    seedProductCatalog(db);
    expect(repository.count()).toBe(88);
  });

  it('retrieves the catalog and applies search and platform filters', async () => {
    const allResponse = await fetch(`${baseUrl}/api/products`);
    expect(allResponse.status).toBe(200);
    const all = await allResponse.json() as any;
    expect(all.totalProducts).toBe(88);
    expect(all.serviceArea).toEqual(DEMO_SERVICE_AREA);
    expect(all.products.every((product: any) => product.pinCode === DEMO_SERVICE_AREA.pinCode)).toBe(true);
    expect(all.source).toBe('seeded_demo');
    expect(all.notice).toContain('not verified live marketplace information');

    const explicitAreaResponse = await fetch(`${baseUrl}/api/products?pinCode=411046`);
    expect(explicitAreaResponse.status).toBe(200);
    expect((await explicitAreaResponse.json() as any).totalProducts).toBe(88);

    const filteredResponse = await fetch(`${baseUrl}/api/products?q=Amul&platform=zepto`);
    expect(filteredResponse.status).toBe(200);
    const filtered = await filteredResponse.json() as any;
    expect(filtered.products.length).toBeGreaterThan(0);
    expect(filtered.products.every((product: any) => product.platform === 'zepto' && /Amul/i.test(product.brand))).toBe(true);

    const categoryResponse = await fetch(`${baseUrl}/api/products?category=Fresh%20Produce`);
    const category = await categoryResponse.json() as any;
    expect(category.products.length).toBeGreaterThan(0);
    expect(category.products.every((product: any) => product.category === 'Fresh Produce')).toBe(true);

    const db = getDatabase();
    db.prepare('UPDATE product_catalog SET available = 0 WHERE id = ?').run('bl-butter');
    try {
      const unavailableResponse = await fetch(`${baseUrl}/api/products?available=false`);
      const unavailable = await unavailableResponse.json() as any;
      expect(unavailable.products.map((product: any) => product.id)).toEqual(['bl-butter']);
    } finally {
      db.prepare('UPDATE product_catalog SET available = 1 WHERE id = ?').run('bl-butter');
    }
  });

  it('rejects unsupported platform and PIN code filters', async () => {
    const response = await fetch(`${baseUrl}/api/products?platform=unknown`);
    expect(response.status).toBe(400);
    const pinResponse = await fetch(`${baseUrl}/api/products?pinCode=411045`);
    expect(pinResponse.status).toBe(400);
    const invalidPinResponse = await fetch(`${baseUrl}/api/products?pinCode=abc`);
    expect(invalidPinResponse.status).toBe(400);
  });

  it('adds a catalog product to the authenticated user pantry and rejects duplicates', async () => {
    getDatabase().prepare(`
      INSERT INTO users (id, name, email, role, created_at, updated_at)
      VALUES ('demo-user', 'Demo Household', 'demo@shoppilot.local', 'guest', ?, ?)
    `).run(new Date().toISOString(), new Date().toISOString());
    const payload = {
      unit: 'g', currentQuantity: 100, averageDailyConsumption: 0,
      minStockThreshold: 0, targetStock: 100, allowSubstitutions: true,
      requireApprovalForBrandChange: true, quantityStep: 50, allowFractions: true,
    };
    const createdResponse = await fetch(`${baseUrl}/api/pantry/from-catalog/bl-butter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(createdResponse.status).toBe(201);
    const { item } = await createdResponse.json() as any;
    expect(item.id).toBe('catalog-butter');
    expect(item.name).toBe('Amul Pasteurised Butter');
    expect(item.preferredBrand).toBe('Amul');

    const duplicateResponse = await fetch(`${baseUrl}/api/pantry/from-catalog/zp-butter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(duplicateResponse.status).toBe(409);
  });

  it('preserves an existing catalog record and assigns it the default PIN during migration', () => {
    const legacyDb = new Database(':memory:');
    try {
      legacyDb.exec(`
        CREATE TABLE product_catalog (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          brand TEXT NOT NULL,
          category TEXT NOT NULL,
          package_size TEXT NOT NULL,
          price_paise INTEGER NOT NULL,
          platform TEXT NOT NULL,
          image_url TEXT,
          available INTEGER NOT NULL DEFAULT 1,
          description TEXT
        );
        INSERT INTO product_catalog (id, name, brand, category, package_size, price_paise, platform)
        VALUES ('legacy-offer', 'Legacy Curd', 'Amul', 'Dairy', '400 g', 7000, 'blinkit');
      `);

      runMigrations(legacyDb);
      const migrated = legacyDb.prepare('SELECT * FROM product_catalog WHERE id = ?').get('legacy-offer') as any;
      expect(migrated.name).toBe('Legacy Curd');
      expect(migrated.pin_code).toBe('411046');

      seedProductCatalog(legacyDb);
      expect((legacyDb.prepare('SELECT COUNT(*) AS count FROM product_catalog').get() as any).count).toBe(89);
      expect((legacyDb.prepare('SELECT COUNT(*) AS count FROM product_catalog WHERE pin_code = ?').get('411046') as any).count).toBe(89);
    } finally {
      legacyDb.close();
    }
  });

  it('keeps the product catalog behind the existing authentication middleware', async () => {
    const protectedServer = createApp().listen(0);
    await new Promise<void>(resolve => protectedServer.once('listening', resolve));
    const address = protectedServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/products`);
      expect(response.status).toBe(401);
    } finally {
      await new Promise<void>(resolve => protectedServer.close(() => resolve()));
    }
  });
});
