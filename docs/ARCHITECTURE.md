# Architecture and technical design

ShopPilot AI is an autonomous grocery replenishment engine designed for household pantry management and multi-store basket optimization with PayPal Sandbox payment settlement.

---

## System architecture

The application is structured as a TypeScript monorepo with three layers:

```mermaid
flowchart TD
    subgraph Browser ["Frontend (React 19 + Vite + Tailwind)"]
        UI["React SPA (Home, Approvals, Pantry, Settings)"]
        Context["ShopPilotContext (State & Polling)"]
        PPSDK["PayPal JS SDK / QR Renderer"]
    end

    subgraph Backend ["Backend (Express on Node 20)"]
        Router["Express Routers (/api/*)"]
        AuthMid["Auth & Rate Limit Middleware"]
        Services["Domain Services (Run, Quote, Policy, Pantry)"]
        PayService["PaymentService (PayPal & Mock)"]
        LLMSvc["LLMService (Gemini & Fallback)"]
    end

    subgraph Storage ["Persistence"]
        SQLite[("SQLite (better-sqlite3 WAL)")]
    end

    subgraph External ["External Services"]
        PayPalAPI["PayPal Sandbox REST API (Orders v2)"]
        GeminiAPI["Google Gemini API (gemini-3.5-flash-lite)"]
    end

    UI --> Context
    Context --> PPSDK
    Context --> Router
    Router --> AuthMid
    AuthMid --> Services
    Services --> SQLite
    Services --> PayService
    Services --> LLMSvc
    PayService --> PayPalAPI
    LLMSvc --> GeminiAPI
```

---

## Data model

The database layer runs on SQLite via `better-sqlite3` with foreign keys and WAL mode enabled (`backend/src/db/migrate.ts`). All domain tables are partitioned by `user_id`.

```mermaid
erDiagram
    users ||--o{ auth_sessions : "has"
    users ||--o{ pantry_items : "owns"
    users ||--o{ policies : "configures"
    users ||--o{ runs : "creates"
    users ||--o{ receipts : "holds"
    users ||--o{ audit_log : "records"
    users ||--o{ user_workspace : "maintains"
    runs ||--o{ run_items : "contains"
    runs ||--o{ approvals : "requires"
    runs ||--o| receipts : "generates"

    users {
        text id PK
        text name
        text email
        text password_hash
        text role
        int email_verified
        text created_at
        text updated_at
    }

    pantry_items {
        text id PK
        text user_id PK
        text name
        text category
        text preferred_brand
        text preferred_package_size
        text unit
        real current_quantity
        real average_daily_consumption
        real min_stock_threshold
        real target_stock
        int allow_substitutions
        int require_approval_for_brand_change
        text last_restocked_date
        int stockout_days_count
        real quantity_step
        int allow_fractions
    }

    policies {
        text id PK
        text user_id PK
        int preferred_shopping_day
        text shopping_frequency
        text next_shopping_date
        text emergency_restock_preference
        int urgent_threshold_days
        int per_cycle_budget_paise
        int per_order_cap_paise
        int require_approval_brand_substitution
        int require_approval_emergency_run
        text blocked_categories
    }

    runs {
        text id PK
        text user_id FK
        text status
        text strategy_type
        int grand_total_paise
        int product_subtotal_paise
        int delivery_fee_paise
        int handling_fee_paise
        int tax_paise
        int discount_paise
        text decision_reasons
        text order_id
        text payment_state
        text paypal_approval_url
        text paypal_capture_id
        text payment_amount
        text payment_currency
    }

    run_items {
        text id PK
        text run_id FK
        text user_id FK
        text pantry_item_id
        text item_name
        text store_id
        text store_product_id
        real quantity
        int unit_price_paise
        int total_price_paise
        int is_substitution
        int is_urgent
        text outcome
        text reasoning
        text approval_status
    }

    receipts {
        text id PK
        text user_id FK
        text run_id FK
        text order_id UK
        int amount_paise
        text currency
        text payment_provider
        text capture_id
        text charged_amount
        text charged_currency
        text items_json
        text breakdown_json
        text status
    }
```

Additional tables:
- `auth_sessions`: Active cookie session hashes (`token_hash`, `user_id`, `expires_at`).
- `password_resets`: Password reset tokens (`token_hash`, `user_id`, `expires_at`, `used_at`).
- `email_verifications`: Email verification tokens (`token_hash`, `user_id`, `expires_at`, `used_at`).
- `sim_clock`: Per-user simulation date, cycle count, and days elapsed.
- `user_workspace`: Draft upcoming order JSON and approved/rejected brand swap choices.
- `audit_log`: Immutable timeline entries (`timestamp`, `simulated_date`, `type`, `title`, `description`, `status_badge`, `badge_color`).
- `webhook_events`: Idempotency tracking for PayPal webhook delivery (`id`, `event_type`, `resource_id`, `processed`, `processed_at`).

---

## Run state machine

A restock run lifecycle progresses through deterministic states managed by `RunRepository` and `PaymentService`:

```mermaid
stateDiagram-v2
    [*] --> planned : POST /api/runs/plan
    planned --> needs_approval : Policy flags cap / swap / emergency
    planned --> auto_approved : Policy passes thresholds
    needs_approval --> approved : POST /api/runs/:id/approve
    needs_approval --> rejected : POST /api/runs/:id/reject
    planned --> blocked : Blocked category item detected

    approved --> payment_pending : POST /api/checkout/create-order
    auto_approved --> payment_pending : POST /api/checkout/create-order

    payment_pending --> paid : POST /api/checkout/capture (Verified capture)
    payment_pending --> failed : Capture fails / rejected
    payment_pending --> payment_pending : POST /api/checkout/cancel (Resets paymentState to CANCELLED)

    paid --> [*]
    rejected --> [*]
    failed --> [*]
    blocked --> [*]
```

### Associated payment states

Each run tracks `payment_state` alongside its status:
- `PENDING`: PayPal order created; awaiting buyer approval.
- `APPROVED`: Buyer approved checkout on PayPal; awaiting capture.
- `CAPTURED`: Capture successfully processed and confirmed.
- `CANCELLED`: Buyer exited or clicked cancel; order retained for retry.
- `FAILED`: Payment provider rejected the capture request.

---

## Money rules and currency conversion

All internal accounting and price comparisons operate strictly on integer paise (`shared/services/currency.ts`):
- `1 INR = 100 paise` (e.g. ₹1,499.50 is stored and calculated as `149950`).
- Integer math prevents floating-point accumulator drift across item prices, taxes, and fees.

### PayPal currency handling

Because the PayPal Orders API does not support INR as a payment currency, cross-border or foreign sandbox testing requires converting INR amounts to USD:
1. `PAYPAL_CURRENCY=USD` and an explicit `PAYPAL_INR_PER_USD` exchange rate (e.g. `85.00`) are defined in configuration.
2. The USD charge is computed using integer cents rounding:
   $$\text{usdCents} = \text{round}\left(\frac{\text{amountPaise}}{\text{inrPerUsd}}\right)$$
   $$\text{chargeAmount} = \frac{\text{usdCents}}{100}$$
3. During capture, the backend checks that the captured USD amount converts back to within half a cent equivalent of the original INR total:
   $$\left|\text{round}(\text{capturedUsdCents} \times \text{inrPerUsd}) - \text{grandTotalPaise}\right| \le \left\lceil\frac{\text{inrPerUsd}}{2}\right\rceil$$
4. No automatic or third-party FX conversions occur; the rate must be explicitly configured.

---

## Checkout and webhook flows

The checkout sequence coordinates the browser, Express backend, PayPal REST API, and SQLite database:

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as User / Judge
    participant App as Frontend (React)
    participant API as Express API
    participant DB as SQLite DB
    participant PP as PayPal Sandbox

    Buyer->>App: Clicks "Confirm and Pay for Order"
    App->>API: POST /api/checkout/create-order { runId }
    API->>DB: Re-verify run and evaluate policy
    API->>PP: POST /v2/checkout/orders (Idempotency: PayPal-Request-Id)
    PP-->>API: Returns { id, links[approve] }
    API->>DB: Set order_id, status: payment_pending, payment_state: PENDING
    API-->>App: Returns { orderId, approvalUrl, chargedAmount, currency }

    App->>Buyer: Displays PayPal Buttons & QR Code
    Buyer->>PP: Approves checkout in PayPal window or mobile browser
    PP-->>App: onApprove callback triggers

    App->>API: POST /api/checkout/capture { orderId }
    API->>PP: POST /v2/checkout/orders/{orderId}/capture
    PP-->>API: Returns 201 Created { status: "COMPLETED", id: captureId }

    rect rgb(240, 248, 255)
        Note over API,DB: Atomic Database Transaction
        API->>DB: Update run status -> "paid", payment_state -> "CAPTURED"
        API->>DB: Insert settled receipt with itemized breakdown
        API->>DB: Replenish pantry quantities to target_stock
        API->>DB: Append audit log entry ("Payment Captured")
    end

    API-->>App: Returns { success: true, receipt, run }
    App->>Buyer: Shows confirmation receipt & updated pantry stock
```

### Webhook verification

When configured (`PAYPAL_WEBHOOK_ID`), incoming webhook events are processed at `POST /api/webhooks/paypal`:
1. The server extracts PayPal signature headers: `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, and `paypal-transmission-time`.
2. The server verifies the signature by calling `POST /v1/notifications/verify-webhook-signature` on the PayPal Sandbox API.
3. If verified, the event ID is checked in `webhook_events` to ensure idempotency. Duplicate events return HTTP 200 immediately without reprocessing.
4. If an order was approved outside the active browser tab, the webhook invokes `syncOrderFromWebhook` to complete the transaction.

---

## Policy engine rules

The policy engine (`shared/policy.ts`) enforces household governance rules deterministically on every restock plan and rechecks them at checkout:

| Rule | Trigger Condition | Decision | Explanation |
|---|---|---|---|
| **Blocked categories** | Any basket item category appears in `policy.blockedCategories` | `blocked` | Hard block. Order cannot be created or checked out until prohibited items are removed. |
| **Per-order spending cap** | `strategy.grandTotalPaise > policy.perOrderCapPaise` | `needs_approval` | Requires manual user confirmation before order is payable. |
| **Weekly / cycle budget cap** | `strategy.grandTotalPaise > policy.perCycleBudgetPaise` | `needs_approval` | Prevents automated spending exceeding the household cycle budget. |
| **Brand substitution** | Item is substitution and `policy.requireApprovalBrandSubstitution` is true | `needs_approval` | User must approve the brand replacement before checkout. |
| **Off-cycle emergency run** | Off-cycle restock and `policy.requireApprovalEmergencyRun` is true | `needs_approval` | Flags standalone delivery fee incurrence for off-cycle orders. |
| **Compliant basket** | All thresholds and constraints met | `auto_approved` | Order is pre-authorized and immediately payable. |

---

## Design decisions

1. **AI proposes and code decides**:
   - The LLM parses plain English into structured JSON proposals and recommends item substitutes from server-supplied candidates.
   - Code enforces the boundaries: Zod schemas validate every AI output, candidate allow-lists reject hallucinated product IDs, and the policy engine strictly controls approvals. The AI cannot place orders or mutate records autonomously.
2. **Server is the source of truth**:
   - The browser never dictates prices, totals, or item lists at checkout.
   - The checkout endpoint recalculates and validates the entire restock basket against the stored run, current pantry state, and policy limits before contacting PayPal.
3. **Restock only after verified capture**:
   - Pantry inventory is never updated upon order creation or payment authorization.
   - Stock replenishment occurs exclusively inside the atomic database transaction that records the settled receipt after PayPal returns a confirmed `COMPLETED` capture.

