import Database from 'better-sqlite3';
import {
  DEFAULT_PANTRY_ITEMS,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SIMULATION_STATE,
  DEFAULT_ACTIVITY_LOG,
} from '@shared/services/defaults';

export function seedDatabase(db: Database.Database, userId: string = 'demo-user'): void {
  const now = new Date().toISOString();

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      updated_at = excluded.updated_at
  `);

  const insertClock = db.prepare(`
    INSERT INTO sim_clock (user_id, simulated_date, days_elapsed, cycle_count, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO NOTHING
  `);

  const insertPolicy = db.prepare(`
    INSERT INTO policies (
      id, user_id, preferred_shopping_day, shopping_frequency, next_shopping_date,
      emergency_restock_preference, urgent_threshold_days, per_cycle_budget_paise,
      per_order_cap_paise, require_approval_brand_substitution, require_approval_emergency_run,
      blocked_categories, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO NOTHING
  `);

  const insertPantryItem = db.prepare(`
    INSERT INTO pantry_items (
      id, user_id, name, category, preferred_brand, preferred_package_size,
      unit, current_quantity, average_daily_consumption, min_stock_threshold,
      target_stock, allow_substitutions, require_approval_for_brand_change,
      last_restocked_date, stockout_days_count, quantity_step, allow_fractions, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO NOTHING
  `);

  const insertAuditLog = db.prepare(`
    INSERT INTO audit_log (
      id, user_id, timestamp, simulated_date, type, title, description, status_badge, badge_color, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  // Run all seed insertions inside a single transaction
  const seedTx = db.transaction(() => {
    // 1. Seed Demo User
    insertUser.run(userId, 'Demo Household', 'demo@shoppilot.local', now, now);

    // 2. Seed Clock
    insertClock.run(
      userId,
      DEFAULT_SIMULATION_STATE.simulatedDate,
      DEFAULT_SIMULATION_STATE.daysElapsed,
      DEFAULT_SIMULATION_STATE.cycleCount,
      now
    );

    // 3. Seed Policy
    insertPolicy.run(
      'default-policy',
      userId,
      DEFAULT_SCHEDULER_CONFIG.preferredShoppingDay,
      DEFAULT_SCHEDULER_CONFIG.shoppingFrequency,
      DEFAULT_SCHEDULER_CONFIG.nextShoppingDate,
      DEFAULT_SCHEDULER_CONFIG.emergencyRestockPreference,
      DEFAULT_SCHEDULER_CONFIG.urgentThresholdDays,
      DEFAULT_SCHEDULER_CONFIG.perCycleBudgetPaise,
      150000, // ₹1,500.00 per-order cap
      1,
      1,
      JSON.stringify([]),
      now,
      now
    );

    // 4. Seed Pantry Items
    for (const item of DEFAULT_PANTRY_ITEMS) {
      const isCountable = ['pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen'].includes(item.unit.toLowerCase());
      const defaultStep = isCountable ? 1 : 0.5;
      const defaultAllowFractions = !isCountable;
      const step = item.quantityStep !== undefined ? item.quantityStep : defaultStep;
      const allowFractions = item.allowFractions !== undefined ? item.allowFractions : defaultAllowFractions;

      insertPantryItem.run(
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
        item.lastRestockedDate,
        item.stockoutDaysCount || 0,
        step,
        allowFractions ? 1 : 0,
        now,
        now
      );
    }

    // 5. Seed Initial Audit Log Entries
    for (const log of DEFAULT_ACTIVITY_LOG) {
      insertAuditLog.run(
        log.id,
        userId,
        log.timestamp,
        log.simulatedDate,
        log.type,
        log.title,
        log.description,
        log.statusBadge || null,
        log.badgeColor || 'blue',
        null
      );
    }
  });

  seedTx();
}
