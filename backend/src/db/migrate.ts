import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'guest')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_verifications_token_hash ON email_verifications(token_hash);
    CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

    CREATE TABLE IF NOT EXISTS user_workspace (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      upcoming_order_json TEXT,
      swap_decisions_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    -- 2. Simulation Clock
    CREATE TABLE IF NOT EXISTS sim_clock (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      simulated_date TEXT NOT NULL,
      days_elapsed INTEGER NOT NULL DEFAULT 0,
      cycle_count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sim_clock_user_id ON sim_clock(user_id);

    -- 3. Pantry Items
    CREATE TABLE IF NOT EXISTS pantry_items (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      preferred_brand TEXT NOT NULL,
      preferred_package_size TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_quantity REAL NOT NULL,
      average_daily_consumption REAL NOT NULL,
      min_stock_threshold REAL NOT NULL,
      target_stock REAL NOT NULL,
      allow_substitutions INTEGER NOT NULL DEFAULT 1,
      require_approval_for_brand_change INTEGER NOT NULL DEFAULT 1,
      last_restocked_date TEXT NOT NULL,
      stockout_days_count INTEGER NOT NULL DEFAULT 0,
      quantity_step REAL NOT NULL DEFAULT 1,
      allow_fractions INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);

    -- 4. Policies
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      preferred_shopping_day INTEGER NOT NULL DEFAULT 2,
      shopping_frequency TEXT NOT NULL DEFAULT 'weekly',
      next_shopping_date TEXT NOT NULL,
      emergency_restock_preference TEXT NOT NULL DEFAULT 'ask_approval',
      urgent_threshold_days INTEGER NOT NULL DEFAULT 3,
      per_cycle_budget_paise INTEGER NOT NULL DEFAULT 250000,
      per_order_cap_paise INTEGER NOT NULL DEFAULT 150000,
      require_approval_brand_substitution INTEGER NOT NULL DEFAULT 1,
      require_approval_emergency_run INTEGER NOT NULL DEFAULT 1,
      blocked_categories TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_policies_user_id ON policies(user_id);

    -- 5. Restock Runs
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL, -- planned | needs_approval | approved | payment_pending | paid | failed | rejected | blocked
      strategy_type TEXT NOT NULL,
      grand_total_paise INTEGER NOT NULL,
      product_subtotal_paise INTEGER NOT NULL,
      delivery_fee_paise INTEGER NOT NULL,
      handling_fee_paise INTEGER NOT NULL,
      tax_paise INTEGER NOT NULL,
      discount_paise INTEGER NOT NULL DEFAULT 0,
      decision_reasons TEXT NOT NULL DEFAULT '[]',
      selected_strategy_details TEXT, -- full strategy snapshot JSON
      all_strategies TEXT, -- all calculated strategies JSON
      order_id TEXT,
      simulated_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

    -- 6. Run Items
    CREATE TABLE IF NOT EXISTS run_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pantry_item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      store_id TEXT NOT NULL,
      store_product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      total_price_paise INTEGER NOT NULL,
      is_substitution INTEGER NOT NULL DEFAULT 0,
      is_urgent INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'approved', -- pending | approved | rejected
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_run_items_run_id ON run_items(run_id);
    CREATE INDEX IF NOT EXISTS idx_run_items_user_id ON run_items(user_id);

    -- 7. Receipts
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE RESTRICT,
      order_id TEXT NOT NULL UNIQUE,
      amount_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_provider TEXT NOT NULL, -- mock | paypal_sandbox
      items_json TEXT NOT NULL,
      breakdown_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'settled', -- settled | refunded
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_run_id ON receipts(run_id);

    -- 8. Approvals
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
      item_id TEXT,
      type TEXT NOT NULL, -- brand_substitution | emergency_run | budget_cap_exceeded | blocked_category
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      reason TEXT NOT NULL,
      decided_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_user_id ON approvals(user_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_run_id ON approvals(run_id);

    -- 9. Audit Log
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      simulated_date TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status_badge TEXT,
      badge_color TEXT,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

    -- 10. Webhook Events (Idempotency)
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'demo-user' REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      resource_id TEXT,
      payload_json TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      processed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events(user_id);
  `);

  function addColumnIfNotExists(table: string, column: string, definition: string): void {
    const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!columns.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    }
  }

  addColumnIfNotExists('users', 'password_hash', 'TEXT');
  addColumnIfNotExists('users', 'role', "TEXT NOT NULL DEFAULT 'user'");
  addColumnIfNotExists('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists('user_workspace', 'swap_decisions_json', "TEXT NOT NULL DEFAULT '{}'");
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci ON users(LOWER(email));');

  // Idempotent column additions for runs
  addColumnIfNotExists('runs', 'order_id', 'TEXT');
  addColumnIfNotExists('runs', 'paypal_order_id', 'TEXT');
  addColumnIfNotExists('runs', 'usd_amount', 'TEXT');
  addColumnIfNotExists('runs', 'usd_rate', 'REAL');
  addColumnIfNotExists('runs', 'payment_amount', 'TEXT');
  addColumnIfNotExists('runs', 'payment_currency', 'TEXT');
  addColumnIfNotExists('runs', 'payment_state', "TEXT NOT NULL DEFAULT 'PENDING'");
  addColumnIfNotExists('runs', 'paypal_approval_url', 'TEXT');
  addColumnIfNotExists('runs', 'paypal_capture_id', 'TEXT');
  addColumnIfNotExists('runs', 'payment_details', 'TEXT');
  addColumnIfNotExists('runs', 'all_strategies', 'TEXT');

  // Idempotent column additions for receipts
  addColumnIfNotExists('receipts', 'capture_id', 'TEXT');
  addColumnIfNotExists('receipts', 'paypal_capture_id', 'TEXT');
  addColumnIfNotExists('receipts', 'charged_amount', 'TEXT');
  addColumnIfNotExists('receipts', 'charged_currency', 'TEXT');
  addColumnIfNotExists('receipts', 'usd_amount', 'TEXT');
  addColumnIfNotExists('receipts', 'usd_rate', 'REAL');
  addColumnIfNotExists('receipts', 'inr_paise', 'INTEGER');
  addColumnIfNotExists('receipts', 'payer_email', 'TEXT');
  addColumnIfNotExists('receipts', 'transaction_json', 'TEXT');

  // Idempotent indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_runs_order_id ON runs(order_id);'); } catch {}
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_order_id_unique ON runs(order_id) WHERE order_id IS NOT NULL;');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_paypal_order_id ON runs(paypal_order_id) WHERE paypal_order_id IS NOT NULL;');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_paypal_capture_id ON runs(paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_capture_id ON receipts(capture_id) WHERE capture_id IS NOT NULL;');

  // Pantry items quantity step and fractions
  addColumnIfNotExists('pantry_items', 'quantity_step', 'REAL');
  addColumnIfNotExists('pantry_items', 'allow_fractions', 'INTEGER');
  addColumnIfNotExists('pantry_items', 'image_url', 'TEXT');
  try {
    db.exec(`
      UPDATE pantry_items SET
        quantity_step = CASE
          WHEN LOWER(unit) IN ('pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen') THEN 1
          ELSE 0.5
        END,
        allow_fractions = CASE
          WHEN LOWER(unit) IN ('pcs', 'packs', 'units', 'eggs', 'loaf', 'pack', 'dozen') THEN 0
          ELSE 1
        END
      WHERE quantity_step IS NULL OR allow_fractions IS NULL;
    `);
  } catch {}
}
