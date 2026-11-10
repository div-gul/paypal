import Database from 'better-sqlite3';
import { ProductCategory, StoreId } from '@shared/types';
import { DEMO_SERVICE_AREA } from '../db/productCatalog.js';

export interface CatalogProduct {
  id: string;
  productGroupId: string;
  name: string;
  brand: string;
  category: ProductCategory;
  packageSize: string;
  pricePaise: number;
  platform: StoreId;
  imageUrl: string | null;
  available: boolean;
  description: string | null;
  pinCode: string;
}

interface CatalogProductRow {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  package_size: string;
  price_paise: number;
  platform: StoreId;
  image_url: string | null;
  available: number;
  description: string | null;
  pin_code: string;
}

export interface CatalogFilters {
  search?: string;
  category?: ProductCategory;
  platform?: StoreId;
  available?: boolean;
  pinCode?: string;
}

function mapRow(row: CatalogProductRow): CatalogProduct {
  return {
    id: row.id,
    productGroupId: row.id.replace(/^(bl|zp|im)-/, '').replace(/-\d+$/, ''),
    name: row.name,
    brand: row.brand,
    category: row.category,
    packageSize: row.package_size,
    pricePaise: row.price_paise,
    platform: row.platform,
    imageUrl: row.image_url,
    available: Boolean(row.available),
    description: row.description,
    pinCode: row.pin_code,
  };
}

export class ProductCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  list(filters: CatalogFilters = {}): CatalogProduct[] {
    const clauses: string[] = ['pin_code = ?'];
    const values: Array<string | number> = [filters.pinCode || DEMO_SERVICE_AREA.pinCode];
    if (filters.search) {
      clauses.push('(name LIKE ? COLLATE NOCASE OR brand LIKE ? COLLATE NOCASE OR category LIKE ? COLLATE NOCASE)');
      const search = `%${filters.search}%`;
      values.push(search, search, search);
    }
    if (filters.category) {
      clauses.push('category = ?');
      values.push(filters.category);
    }
    if (filters.platform) {
      clauses.push('platform = ?');
      values.push(filters.platform);
    }
    if (filters.available !== undefined) {
      clauses.push('available = ?');
      values.push(filters.available ? 1 : 0);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM product_catalog ${where} ORDER BY name COLLATE NOCASE, platform`).all(...values) as CatalogProductRow[];
    return rows.map(mapRow);
  }

  findById(id: string, pinCode = DEMO_SERVICE_AREA.pinCode): CatalogProduct | null {
    const row = this.db.prepare('SELECT * FROM product_catalog WHERE id = ? AND pin_code = ?').get(id, pinCode) as CatalogProductRow | undefined;
    return row ? mapRow(row) : null;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM product_catalog').get() as { count: number }).count;
  }
}
