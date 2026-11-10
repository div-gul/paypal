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
│   └── src/adapters/     # Store adapters for simulated quick-commerce catalogs
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

### 4. Accounts
The app opens on the Login page. Register for a personal account. A seeded Guest account is available only in local development and tests; production does not seed or accept the shared guest account.

New accounts start with an empty pantry, no saved restocking policy, orders, approvals, or activity history. Future Simulation is available to the Guest account only; the backend enforces this restriction.

### 5. Run Test Suites
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
| `PAYPAL_MODE` | `mock` | `mock`, `sandbox`, or explicitly enabled `live` for PayPal Orders v2 |
| `ALLOW_LIVE_PAYMENTS` | `false` | Must be `true` together with `PAYPAL_MODE=live` and the official live API host to enable real charges |
| `PAYPAL_CLIENT_ID` | — | PayPal App Client ID (backend config; returned to authenticated checkout UI for the JS SDK) |
| `PAYPAL_CLIENT_SECRET` | — | PayPal App Secret; backend only |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` | PayPal API origin |
| `PAYPAL_WEBHOOK_ID` | — | Webhook ID used for PayPal signature verification |
| `PAYPAL_CURRENCY` | `INR` | `INR` or `USD`; no silent currency fallback is performed |
| `PAYPAL_INR_PER_USD` | — | Required explicit INR-per-USD rate when charging in USD |
| `APP_BASE_URL` | `http://localhost:5173` | Publicly reachable frontend URL used for PayPal return/cancel redirects |
| `PUBLIC_APP_URL` | `APP_BASE_URL` origin | Exact browser origin allowed by CORS; use HTTPS in production |
| `LLM_API_KEY` | `""` | Optional API key for external LLM parsing (falls back to deterministic NLP) |

---

## 4. Real vs. Simulated Transparency Table

To maintain complete integrity for hackathon judges, here is the transparent breakdown:

| Capability | Real | Simulated / Mocked | Explanation |
|---|---|---|---|
| **PayPal Checkout** | PayPal Orders v2 in Sandbox mode | Explicit mock mode only | OAuth client credentials, server-created orders, server captures, persisted payment states, verified webhooks and approval-link QR codes. Live mode is disabled unless explicitly enabled in server config. |
| **Store Pricing & Quotes** | — | **Simulated** (Local Quick-Commerce Catalog) | Local store adapters provide simulated Blinkit, Zepto, and Instamart prices for the autonomous basket optimizer. |
| **Integer-Paise Money Math** | **Real** | — | Floating point arithmetic is forbidden. All monetary math uses integer paise (`₹1.00 = 100 paise`), preventing roundoff leakage. |
| **Depletion & Burning** | **Real** (Deterministic) | — | Mathematical consumption formulas ($ \text{Stock} / \text{Burn} $) accurately project stockout days. |
| **Multi-Store Basket Optimization** | **Real** | — | Dynamically compares 4 basket strategies accounting for independent delivery, handling, and minimum-order fees. |
| **AI Policy Parsing & Substitution** | **Real** (NLP Engine) | — | Server-side parser extracts budget caps, shopping days, and blocked categories. Substitutions are strictly validated against server candidate lists. |
| **Store Fulfillment / Couriers** | — | **Simulated** | We do not dispatch real delivery riders or place live grocery orders with Blinkit/Zepto. |

---

## 5. API Endpoint Reference

All endpoints are scoped to `demo-user` via auth middleware and return errors in standard `{ error: { code, message, details? } }` format.

### Seeded Product Catalog

The backend stores and serves 33 curated product groups as 88 platform-specific offers from Blinkit, Zepto, and Instamart in SQLite for the current demo service area: **Katraj, Pune, Maharashtra – 411046, India**. Categories include fresh produce, dairy, bakery, pantry staples, breakfast and cereals, snacks, beverages, personal care, and household essentials. This is a static curated demo dataset with illustrative prices and simulated offers; it is not live-scraped. Actual platform delivery coverage and inventory in this PIN code have not been verified, and the data does not represent real-time prices or availability.

- `GET /api/products` — Authenticated catalog listing; defaults to PIN code `411046` and supports `pinCode`, `q`, `category`, `platform` (`blinkit`, `zepto`, or `instamart`), and `available` (`true` or `false`) filters. Only the Katraj demo area is currently supported.

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
- `GET /api/checkout/config` — Public PayPal JS SDK Client ID and checkout mode/currency (never the Client Secret).
- `POST /api/checkout/create-order` — Verify policy approval on server; initiate PayPal sandbox order.
- `POST /api/checkout/capture` — Captures through PayPal, then atomically updates the run, receipt, pantry and audit log. Idempotent on repeat.
- `GET /api/checkout/status/:runId` — Recovers payment status after a refresh and captures a buyer-approved QR order from the server.
- `POST /api/checkout/cancel` — Records a cancelled attempt while preserving the order for retry.
- `POST /api/webhooks/paypal` — Verifies signatures with PayPal and processes capture/order events idempotently.

### PayPal Sandbox setup and test

1. Copy `backend/.env.example` to `backend/.env` and set the Sandbox Business App Client ID, Client Secret, and `PAYPAL_MODE=sandbox`. Keep the Client Secret in this backend file only.
2. PayPal's current REST currency list does not include INR. Keep `PAYPAL_CURRENCY=INR` to get an explicit PayPal rejection, or intentionally charge USD by setting `PAYPAL_CURRENCY=USD` and the merchant-approved `PAYPAL_INR_PER_USD` conversion rate. ShopPilot does not fetch or guess an exchange rate; the browser shows the USD charge beside the INR basket total.
3. Set `APP_BASE_URL` to the frontend address reachable by the QR buyer's device. For a local second-device test, expose Vite on the LAN with `npm --prefix frontend run dev -- --host 0.0.0.0` and use the computer's LAN IP, or use a trusted HTTPS tunnel. `localhost` on the buyer's phone points to the phone itself.
4. Start with `npm run dev`, approve the order, and click **Confirm and Pay for Order**. The official PayPal button opens Sandbox checkout; the QR contains that same order's PayPal approval URL. Scan it with a Sandbox Personal buyer account while keeping the original ShopPilot tab open.
5. Confirm that the original tab changes to captured only after the server confirms PayPal capture. In the Sandbox Business account, verify the transaction. Test cancel, retry, refresh/reopen, duplicate capture, invalid run ID, and failed capture. Configure a webhook ID in PayPal Developer only if testing webhook delivery; local checkout-status polling does not depend on webhooks.

Sandbox end-to-end capture requires a Sandbox Personal buyer login and a deliberate supported currency/rate choice. Automated backend tests use the explicit mock provider and do not create PayPal transactions.

### Security

See [SECURITY.md](SECURITY.md) for security controls, deployment settings, limitations and responsible disclosure. Production uses authenticated, user-scoped data routes, origin checks, rate limits, security headers, explicit HTTPS origins and a sandbox-only PayPal API host unless live payments are deliberately enabled.

Run the local curl-based verification checks with the setup in [docs/security-checks.md](docs/security-checks.md) and `bash docs/security-checks.sh`.

### Rate limiting

Unauthenticated requests to protected API routes and `/api/auth/me` are limited to 60 requests per 15 minutes per client IP; excess requests receive HTTP 429. The limiter uses in-memory counters, which reset when the backend restarts and are not shared across backend instances. Authenticated requests retain the existing limit of 300 requests per 15 minutes per user. Signup, login, logout, health, and PayPal webhook routes retain their existing rate-limiting behavior.

### PayPal webhook verification

The backend uses PayPal's official webhook signature-verification API, validates required transmission headers, and accepts events only when PayPal returns `verification_status: SUCCESS`. Events must have a valid structure and event ID; duplicate processing is prevented through idempotency. Automated mock tests for webhook verification have passed. Real PayPal Sandbox webhook delivery and signature verification have **not** been independently confirmed: PayPal cannot directly reach the localhost endpoint used for testing. Verification requires a publicly accessible HTTPS endpoint or HTTPS tunnel.

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

## License

See the [MIT License](LICENSE).
