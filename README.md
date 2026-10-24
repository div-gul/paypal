# ShopPilot AI — Autonomous Weekly Grocery Shopping Agent

ShopPilot AI is a college hackathon prototype demonstrating an autonomous grocery agent that predicts household depletion, schedules weekly restocking, and optimizes final multi-store basket costs by accounting for independent delivery fees.

---

## 1. Project Overview
Most households suffer from "pantry blindness", making frequent emergency quick-commerce orders that multiply delivery and handling fees. Furthermore, picking the cheapest individual item across multiple apps often backfires when split delivery charges exceed item-level savings.

ShopPilot AI solves this by tracking estimated household burn rates, forecasting when items will run out, deferring safe items to a scheduled weekly run to save fees, and optimizing multi-store baskets with exact integer-paise fee calculations.

---

## 2. Key Features
- **Consumption-Aware Pantry**: Tracks household inventory with user-defined burn rates, calculating estimated days remaining ($ \text{Stock} / \text{Daily Burn} $).
- **Weekly Restocking Scheduler**: Compares inventory against the next scheduled run date; defers safe items, bundles low items, and flags urgent runouts.
- **Delivery-Fee-Aware Basket Optimizer**: Evaluates 4 purchasing strategies (Lowest Price Split, Single-Store Consolidation, Smart Split, Defer Non-Urgent) with independent per-store fees.
- **Final Basket Itemization**: Provides a detailed, transparent breakdown of all products, quantities, prices, and store fulfillments in the chosen basket.
- **Policy & Approval Rules**: Enforces budget limits and requires user sign-off before brand substitutions or emergency off-cycle orders.
- **Demonstration Time Machine**: Fast-forwards time by 1, 3, or 7 days to simulate real-world inventory depletion and stockouts.
- **Simulated PayPal Checkout**: Authenticates a sandbox transaction, generates order receipts, and automatically replenishes pantry inventory.

---

## 3. How It Works
1. **Track Pantry**: User enters household items, preferred brands, current stock, and daily consumption rates.
2. **Forecast Depletion**: System continuously calculates days remaining and projected stock at the next scheduled shopping date.
3. **Autonomous Analysis**: Items running out before the run become urgent; items lasting safely are deferred to avoid standalone delivery fees.
4. **Optimize Basket**: Adapter engine gathers store quotes (Blinkit, Zepto, Instamart) and computes independent delivery, handling, and minimum-order fees.
5. **Review & Approve**: User approves brand changes or emergency orders, or manually adds/removes items from the basket.
6. **Simulated Checkout**: PayPal sandbox payment is simulated, generating a transaction receipt and replenishing pantry levels.
7. **Audit Trail**: Every decision, approval, and order is recorded into an immutable activity timeline.

---

## 4. Tech Stack
- **Frontend Framework**: React 19, TypeScript 5.7
- **Styling**: Tailwind CSS 3.4, Lucide React Icons
- **Build & Dev Tool**: Vite 6.2
- **Testing**: Node 24 native ESM runner (`--experimental-strip-types`) with Vite SSR test bundle
- **Persistence**: Browser `localStorage` API

---

## 5. Getting Started

### Prerequisites
- Node.js `v20.x` or `v24.x`
- npm `v10.x` or higher

### Commands
```bash
# Install dependencies
npm install

# Start local development server (http://localhost:5173)
npm run dev

# Run automated test suite
npm test

# Build production bundle
npm run build
```

---

## 6. Demo Guide
1. **Examine the Pantry**: Note preloaded items like Milk (lasts 1.2 days at 0.5L/day) and Coffee (lasts 17.5 days).
2. **Review Restock Decisions**: Milk is flagged as **URGENT** (runs out before the shopping run in 3 days), while Coffee is **DEFERRED**.
3. **Compare Optimizer Strategies**: Strategy B (Single-Store) is recommended because Strategy A splits items across stores, multiplying delivery fees.
4. **Inspect Final Basket Items**: Review the dedicated itemized table showing store fulfillments, unit prices, and quantities.
5. **Advance Time**: Click **`+1 Day`** twice on the Time Machine. Watch Milk deplete to 0, triggering an automatic stockout alert.
6. **Approve & Checkout**: Click **"Approve & Add to Basket"** for urgent items, click **"Checkout Proposed Basket"**, and authorize via the PayPal Sandbox modal to replenish stock.

---

## 7. Current Limitations
- **Simulated Grocery Data**: Store prices, catalogs, and availability for Blinkit, Zepto, and Swiggy Instamart are mock datasets behind `IGroceryStoreAdapter`. No live scraping or private quick-commerce APIs are used.
- **Simulated Checkout**: The PayPal integration runs in a frontend simulation mode; no real money is processed and no live orders are placed.
- **No Production Backend**: Operates as a client-side prototype using `localStorage`. There is no live PostgreSQL database, user authentication, or headless server cron.
- **No Physical Sensing**: Inventory updates depend on user-configured estimates, not smart hardware or scales.

---

## 8. Future Roadmap
- [ ] Build the backend and database.
- [ ] Add secure user accounts and server-side policy enforcement.
- [ ] Investigate authorized access to real grocery catalog, pricing, and availability data.
- [ ] Implement background scheduling and notifications.
- [ ] Integrate supported payment and ordering workflows.
- [ ] Test and deploy the complete system.
