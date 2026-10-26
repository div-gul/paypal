import Database from 'better-sqlite3';
import { PantryItem, ProductCategory, UnitOfMeasurement } from '@shared/types';

interface PantryItemRow {
  id: string;
  user_id: string;
  name: string;
  category: ProductCategory;
  preferred_brand: string;
  preferred_package_size: string;
  unit: UnitOfMeasurement;
  current_quantity: number;
  average_daily_consumption: number;
  min_stock_threshold: number;
  target_stock: number;
  allow_substitutions: number;
  require_approval_for_brand_change: number;
  last_restocked_date: string;
  stockout_days_count: number;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: PantryItemRow): PantryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    preferredBrand: row.preferred_brand,
    preferredPackageSize: row.preferred_package_size,
    unit: row.unit,
    currentQuantity: row.current_quantity,
    averageDailyConsumption: row.average_daily_consumption,
    minStockThreshold: row.min_stock_threshold,
    targetStock: row.target_stock,
    allowSubstitutions: Boolean(row.allow_substitutions),
    requireApprovalForBrandChange: Boolean(row.require_approval_for_brand_change),
    lastRestockedDate: row.last_restocked_date,
    stockoutDaysCount: row.stockout_days_count,
  };
}

export class PantryRepository {
  constructor(private db: Database.Database) {}

  getAllByUserId(userId: string): PantryItem[] {
    const stmt = this.db.prepare('SELECT * FROM pantry_items WHERE user_id = ? ORDER BY name ASC');
    const rows = stmt.all(userId) as PantryItemRow[];
    return rows.map(rowToItem);
  }

  getById(userId: string, id: string): PantryItem | null {
    const stmt = this.db.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND id = ?');
    const row = stmt.get(userId, id) as PantryItemRow | undefined;
    return row ? rowToItem(row) : null;
  }

  create(userId: string, item: Omit<PantryItem, 'stockoutDaysCount'>): PantryItem {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO pantry_items (
        id, user_id, name, category, preferred_brand, preferred_package_size,
        unit, current_quantity, average_daily_consumption, min_stock_threshold,
        target_stock, allow_substitutions, require_approval_for_brand_change,
        last_restocked_date, stockout_days_count, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(
      item.id,
      userId,
      item.name,
      item.category,
      item.preferredBrand,
      item.preferredPackageSize,
      item.unit,
      item.currentQuantity,
      item.averageDailyConsumption,
      item.minStockThreshold,
      item.targetStock,
      item.allowSubstitutions ? 1 : 0,
      item.requireApprovalForBrandChange ? 1 : 0,
      item.lastRestockedDate || now,
      0,
      now,
      now
    ) as PantryItemRow;

    return rowToItem(row);
  }

  update(userId: string, item: PantryItem): PantryItem {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE pantry_items
      SET name = ?,
          category = ?,
          preferred_brand = ?,
          preferred_package_size = ?,
          unit = ?,
          current_quantity = ?,
          average_daily_consumption = ?,
          min_stock_threshold = ?,
          target_stock = ?,
          allow_substitutions = ?,
          require_approval_for_brand_change = ?,
          last_restocked_date = ?,
          stockout_days_count = ?,
          updated_at = ?
      WHERE user_id = ? AND id = ?
      RETURNING *
    `);

    const row = stmt.get(
      item.name,
      item.category,
      item.preferredBrand,
      item.preferredPackageSize,
      item.unit,
      item.currentQuantity,
      item.averageDailyConsumption,
      item.minStockThreshold,
      item.targetStock,
      item.allowSubstitutions ? 1 : 0,
      item.requireApprovalForBrandChange ? 1 : 0,
      item.lastRestockedDate,
      item.stockoutDaysCount,
      now,
      userId,
      item.id
    ) as PantryItemRow | undefined;

    if (!row) {
      throw new Error(`Pantry item ${item.id} not found for user ${userId}`);
    }

    return rowToItem(row);
  }

  delete(userId: string, id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM pantry_items WHERE user_id = ? AND id = ?');
    const result = stmt.run(userId, id);
    return result.changes > 0;
  }

  batchSave(userId: string, items: PantryItem[]): void {
    const updateStmt = this.db.prepare(`
      UPDATE pantry_items
      SET current_quantity = ?,
          last_restocked_date = ?,
          stockout_days_count = ?,
          updated_at = ?
      WHERE user_id = ? AND id = ?
    `);

    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      for (const item of items) {
        updateStmt.run(
          item.currentQuantity,
          item.lastRestockedDate,
          item.stockoutDaysCount,
          now,
          userId,
          item.id
        );
      }
    });

    tx();
  }
}
