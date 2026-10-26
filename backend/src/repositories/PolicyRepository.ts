import Database from 'better-sqlite3';
import { WeeklySchedulerConfig } from '@shared/types';

export interface PolicyEntity extends WeeklySchedulerConfig {
  id: string;
  perOrderCapPaise: number;
  requireApprovalBrandSubstitution: boolean;
  requireApprovalEmergencyRun: boolean;
  blockedCategories: string[];
  createdAt: string;
  updatedAt: string;
}

interface PolicyRow {
  id: string;
  user_id: string;
  preferred_shopping_day: number;
  shopping_frequency: 'weekly' | 'biweekly';
  next_shopping_date: string;
  emergency_restock_preference: 'ask_approval' | 'auto_order' | 'alert_only';
  urgent_threshold_days: number;
  per_cycle_budget_paise: number;
  per_order_cap_paise: number;
  require_approval_brand_substitution: number;
  require_approval_emergency_run: number;
  blocked_categories: string;
  created_at: string;
  updated_at: string;
}

function rowToPolicy(row: PolicyRow): PolicyEntity {
  let categories: string[] = [];
  try {
    categories = JSON.parse(row.blocked_categories);
  } catch {
    categories = [];
  }

  return {
    id: row.id,
    preferredShoppingDay: row.preferred_shopping_day,
    shoppingFrequency: row.shopping_frequency,
    nextShoppingDate: row.next_shopping_date,
    emergencyRestockPreference: row.emergency_restock_preference,
    urgentThresholdDays: row.urgent_threshold_days,
    perCycleBudgetPaise: row.per_cycle_budget_paise,
    perOrderCapPaise: row.per_order_cap_paise,
    requireApprovalBrandSubstitution: Boolean(row.require_approval_brand_substitution),
    requireApprovalEmergencyRun: Boolean(row.require_approval_emergency_run),
    blockedCategories: categories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PolicyRepository {
  constructor(private db: Database.Database) {}

  getByUserId(userId: string): PolicyEntity | null {
    const stmt = this.db.prepare('SELECT * FROM policies WHERE user_id = ? LIMIT 1');
    const row = stmt.get(userId) as PolicyRow | undefined;
    return row ? rowToPolicy(row) : null;
  }

  upsert(userId: string, policy: Partial<PolicyEntity>): PolicyEntity {
    const current = this.getByUserId(userId);
    const now = new Date().toISOString();

    const merged = {
      id: policy.id || current?.id || 'default-policy',
      preferredShoppingDay: policy.preferredShoppingDay ?? current?.preferredShoppingDay ?? 2,
      shoppingFrequency: policy.shoppingFrequency ?? current?.shoppingFrequency ?? 'weekly',
      nextShoppingDate: policy.nextShoppingDate ?? current?.nextShoppingDate ?? new Date().toISOString(),
      emergencyRestockPreference: policy.emergencyRestockPreference ?? current?.emergencyRestockPreference ?? 'ask_approval',
      urgentThresholdDays: policy.urgentThresholdDays ?? current?.urgentThresholdDays ?? 3,
      perCycleBudgetPaise: policy.perCycleBudgetPaise ?? current?.perCycleBudgetPaise ?? 250000,
      perOrderCapPaise: policy.perOrderCapPaise ?? current?.perOrderCapPaise ?? 150000,
      requireApprovalBrandSubstitution: policy.requireApprovalBrandSubstitution ?? current?.requireApprovalBrandSubstitution ?? true,
      requireApprovalEmergencyRun: policy.requireApprovalEmergencyRun ?? current?.requireApprovalEmergencyRun ?? true,
      blockedCategories: policy.blockedCategories ?? current?.blockedCategories ?? [],
    };

    const stmt = this.db.prepare(`
      INSERT INTO policies (
        id, user_id, preferred_shopping_day, shopping_frequency, next_shopping_date,
        emergency_restock_preference, urgent_threshold_days, per_cycle_budget_paise,
        per_order_cap_paise, require_approval_brand_substitution, require_approval_emergency_run,
        blocked_categories, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET
        preferred_shopping_day = excluded.preferred_shopping_day,
        shopping_frequency = excluded.shopping_frequency,
        next_shopping_date = excluded.next_shopping_date,
        emergency_restock_preference = excluded.emergency_restock_preference,
        urgent_threshold_days = excluded.urgent_threshold_days,
        per_cycle_budget_paise = excluded.per_cycle_budget_paise,
        per_order_cap_paise = excluded.per_order_cap_paise,
        require_approval_brand_substitution = excluded.require_approval_brand_substitution,
        require_approval_emergency_run = excluded.require_approval_emergency_run,
        blocked_categories = excluded.blocked_categories,
        updated_at = excluded.updated_at
      RETURNING *
    `);

    const row = stmt.get(
      merged.id,
      userId,
      merged.preferredShoppingDay,
      merged.shoppingFrequency,
      merged.nextShoppingDate,
      merged.emergencyRestockPreference,
      merged.urgentThresholdDays,
      merged.perCycleBudgetPaise,
      merged.perOrderCapPaise,
      merged.requireApprovalBrandSubstitution ? 1 : 0,
      merged.requireApprovalEmergencyRun ? 1 : 0,
      JSON.stringify(merged.blockedCategories),
      current?.createdAt || now,
      now
    ) as PolicyRow;

    return rowToPolicy(row);
  }
}
