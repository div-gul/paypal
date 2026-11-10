import { NextFunction, Request, Response, Router } from 'express';
import { ProductCategory, StoreId } from '@shared/types';
import { getDatabase } from '../db/connection.js';
import { DEMO_SERVICE_AREA } from '../db/productCatalog.js';
import { CatalogFilters, ProductCatalogRepository } from '../repositories/ProductCatalogRepository.js';

export const productsRouter = Router();

const platforms: StoreId[] = ['blinkit', 'zepto', 'instamart'];
const categories: ProductCategory[] = [
  'Dairy', 'Bakery & Bread', 'Fresh Produce', 'Beverages', 'Pantry Staples',
  'Breakfast & Cereals', 'Snacks', 'Personal Care', 'Household', 'Household Essentials',
];

productsRouter.get('/products', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: CatalogFilters = { pinCode: DEMO_SERVICE_AREA.pinCode };
    if (req.query.pinCode !== undefined) {
      if (typeof req.query.pinCode !== 'string' || !/^\d{6}$/.test(req.query.pinCode)) {
        res.status(400).json({ error: { code: 'INVALID_SERVICE_AREA', message: 'PIN code must contain six digits.' } });
        return;
      }
      if (req.query.pinCode !== DEMO_SERVICE_AREA.pinCode) {
        res.status(400).json({ error: { code: 'UNSUPPORTED_SERVICE_AREA', message: 'The catalog currently supports Katraj, Pune (411046) only.' } });
        return;
      }
      filters.pinCode = req.query.pinCode;
    }
    if (req.query.q !== undefined) {
      if (typeof req.query.q !== 'string' || req.query.q.length > 100) {
        res.status(400).json({ error: { code: 'INVALID_PRODUCT_FILTER', message: 'Search text must be 100 characters or fewer.' } });
        return;
      }
      filters.search = req.query.q.trim();
    }
    if (req.query.category !== undefined) {
      if (typeof req.query.category !== 'string' || !categories.includes(req.query.category as ProductCategory)) {
        res.status(400).json({ error: { code: 'INVALID_PRODUCT_FILTER', message: 'Unknown product category.' } });
        return;
      }
      filters.category = req.query.category as ProductCategory;
    }
    if (req.query.platform !== undefined) {
      if (typeof req.query.platform !== 'string' || !platforms.includes(req.query.platform as StoreId)) {
        res.status(400).json({ error: { code: 'INVALID_PRODUCT_FILTER', message: 'Unknown store platform.' } });
        return;
      }
      filters.platform = req.query.platform as StoreId;
    }
    if (req.query.available !== undefined) {
      if (req.query.available !== 'true' && req.query.available !== 'false') {
        res.status(400).json({ error: { code: 'INVALID_PRODUCT_FILTER', message: 'Availability must be true or false.' } });
        return;
      }
      filters.available = req.query.available === 'true';
    }

    const products = new ProductCatalogRepository(getDatabase()).list(filters);
    res.json({
      totalProducts: products.length,
      products,
      serviceArea: DEMO_SERVICE_AREA,
      source: 'seeded_demo',
      notice: 'Products, prices, platform offers, delivery coverage, and availability are simulated demo data and are not verified live marketplace information.',
    });
  } catch (err) {
    next(err);
  }
});
