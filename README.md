# ShopPilot AI — Autonomous Grocery Restocking & Multi-Store Basket Optimizer

ShopPilot AI is an autonomous grocery restocking agent developed for the PayPal AI Hackathon. It forecasts household grocery depletion, schedules weekly restocking to eliminate emergency order delivery fees, optimizes multi-store baskets with fee-aware integer-paise arithmetic, and executes policy-compliant checkout via PayPal Sandbox.

> **CRITICAL SANDBOX NOTICE**: All payment transactions are strictly executed in **PayPal Sandbox mode** (`PAYPAL_MODE=mock|sandbox`) using test sandbox credentials. **No real money moves, and no live credit/debit cards are charged.**

---

## 1. Monorepo Architecture

```
paypal/
├── frontend/             # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/components/   # UI components (Pantry, Optimizer, Time Machine, Health Badge)
│   ├── src/context/      # React State Provider with localStorage fallback & backend proxy
│   └── vite.config.ts    # Proxies /api -> http://localhost:3001
├── backend/              # Node.js + Express + TypeScript + SQLite (better-sqlite3)
│   ├── src/db/           # SQLite connection, WAL mode, schema migrations & idempotent seeds
│   ├── src/repositories/ # 10 user-scoped repositories (users, pantry, policies, runs, etc.)
│   ├── src/services/     # Three-tier business logic (Pantry, Policy, Run, Quote, Payment, AI)
│   ├── src/routes/       # Zod-validated HTTP endpoints (no direct DB logic)
│   └── src/adapters/     # Channel3 API adapter with fallback to mock catalog
├── shared/               # Pure business logic shared across frontend and backend
│   ├── types/            # Canonical domain types (PantryItem, StoreProduct, BasketStrategy)
│   ├── services/         # Consumption engine, restock scheduler, basket optimizer, currency
│   ├── adapters/         # Store adapter interfaces and fee calculation logic
│   └── policy.ts         # Deterministic policy engine (spending caps, brand rules, blocked categories)
└── package.json          # Monorepo root scripts (concurrent dev, unified test & build)
```

---

## 2. Quick Start (Single Command)

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or higher

### 1. Setup Environment
```bash
# Copy example environment variables
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 3. Run Dev Server (Frontend + Backend)
```bash
npm run dev
```
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Frontend App**: [http://localhost:5173](http://localhost:5173) (or dynamic Vite port)

### 4. Run Test Suites
```bash
# Run all tests across backend (Vitest) and frontend (autonomous suite)
npm test

# Build production bundles for both backend and frontend
npm run build
```

---

## 3. Environment Variables Reference

All secrets reside exclusively on the backend. The frontend consumes the backend via Vite's proxy `/api`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express backend listening port |
| `DATABASE_PATH` | `./data/shoppilot.db` | SQLite database file location (`:memory:` supported for tests) |
| `PAYPAL_MODE` | `mock` | `mock` (simulated in-memory) or `sandbox` (PayPal sandbox API) |
| `PAYPAL_CLIENT_ID` | `sandbox_client_id_placeholder` | PayPal Developer Sandbox App Client ID |
| `PAYPAL_CLIENT_SECRET` | `sandbox_secret_placeholder` | PayPal Developer Sandbox App Secret |
| `PAYPAL_WEBHOOK_ID` | `sandbox_webhook_id_placeholder` | PayPal Webhook verification ID |
| `QUOTE_SOURCE` | `mock` | `mock` (static catalog), `channel3` (live API), or `hybrid` |
| `CHANNEL3_API_KEY` | `""` | Optional API key for live grocery pricing from Channel3 |
| `LLM_API_KEY` | `""` | Optional API key for external LLM parsing (falls back to deterministic NLP) |

---

## 4. Real vs. Simulated Transparency Table

To maintain complete integrity for hackathon judges, here is the transparent breakdown:

| Capability | Real | Simulated / Mocked | Explanation |
|---|---|---|---|
| **PayPal Checkout** | **Real** (Sandbox Mode) | — | Generates real PayPal order IDs, verifies capture state, handles raw webhook events. Sandbox accounts only; zero real money. |
| **Store Pricing & Quotes** | **Real** (Channel3 Web Check) | **Mock** (Local Quick-Commerce Catalog) | Quick-commerce grocery quotes (Blinkit, Zepto, Instamart) power the autonomous basket optimizer with real fee mechanics. Channel3 provides real web product price checks for non-grocery items (under storeId `web`, separated into `webQuotes`), preventing irrelevant web listings from polluting the grocery optimizer. |
| **Integer-Paise Money Math** | **Real** | — | Floating point arithmetic is forbidden. All monetary math uses integer paise (`₹1.00 = 100 paise`), preventing roundoff leakage. |
| **Depletion & Burning** | **Real** (Deterministic) | — | Mathematical consumption formulas ($ \text{Stock} / \text{Burn} $) accurately project stockout days. |
| **Multi-Store Basket Optimization** | **Real** | — | Dynamically compares 4 basket strategies accounting for independent delivery, handling, and minimum-order fees. |
| **AI Policy Parsing & Substitution** | **Real** (NLP Engine) | — | Server-side parser extracts budget caps, shopping days, and blocked categories. Substitutions are strictly validated against server candidate lists. |
| **Store Fulfillment / Couriers** | — | **Simulated** | We do not dispatch real delivery riders or place live grocery orders with Blinkit/Zepto. |

---

## 5. API Endpoint Reference

All endpoints are scoped to `demo-user` via auth middleware and return errors in standard `{ error: { code, message, details? } }` format.

### Health & State
- `GET /api/health` — Backend health, service mode, active user ID.
- `GET /api/state` — Complete hydrated state snapshot (clock, pantry, policy, latest run, stats).

### Pantry Management
- `GET /api/pantry` — List all user pantry items.
- `POST /api/pantry` — Add new pantry item with burn rate and thresholds.
- `GET /api/pantry/:id` — Fetch single pantry item.
- `PUT /api/pantry/:id` — Update item details, target stock, or substitution preferences.
- `DELETE /api/pantry/:id` — Remove item from pantry.
- `POST /api/pantry/:id/adjust` — Adjust stock quantity (e.g. manual restock or manual consume).

### Restock Policy & Time Machine
- `GET /api/policy` — Get weekly scheduler configuration and spending caps.
- `PUT /api/policy` — Update budget limits, per-order caps, preferred restock day, and blocked categories.
- `POST /api/time/advance` — Fast-forward simulation clock by $N$ days, apply consumption depletion, and update stockout counters.

### Restocking Runs & Basket Optimization
- `POST /api/runs/plan` — Generate restock run, evaluate 4 basket strategies, and enforce policy rules (`auto_approved`, `needs_approval`, or `blocked`).
- `GET /api/runs/:id` — Retrieve planned run details with line items.
- `POST /api/runs/:id/approve` — User approves a run flagged with `needs_approval`.
- `POST /api/runs/:id/reject` — User rejects a planned run.

### Checkout & PayPal Integration
- `POST /api/checkout/create-order` — Verify policy approval on server; initiate PayPal sandbox order.
- `POST /api/checkout/capture` — Atomic capture transaction: updates run to `paid`, creates settled receipt, restocks pantry items, and logs audit trail. Idempotent on repeat.
- `POST /api/webhooks/paypal` — Processes incoming PayPal webhook events with raw-body signature validation and idempotent tracking.

### AI Endpoints (Server-Side, Validated)
- `POST /api/ai/parse-policy` — Translates natural language into a proposed policy modification (proposal only; never auto-saved without user confirmation).
- `POST /api/ai/substitute` — Selects closest in-stock alternative strictly from server-provided candidates; rejects hallucinations.

---

## 6. Testing & Quality Verification

```bash
# 1. Backend Vitest Suite (29 automated tests)
npm --prefix backend test

# 2. Frontend Autonomous Verification Suite (5 verification stages)
npm --prefix frontend test

# 3. Production Build Validation (TypeScript + Vite SSR + Vite Client)
npm run build
```

---

## 7. License & Hackathon Submission
Developed for the **PayPal AI Hackathon 2026**. Licensed under the MIT License.
