# Devpost Submission

## Project name
ShopPilot AI

## Tagline
Choose one option (under 60 characters):
1. Autonomous grocery restocks with fee-aware PayPal checkout
2. Smart pantry replenishment optimized across local stores
3. Restock household groceries autonomously with PayPal and AI

## Short description
ShopPilot AI forecasts household grocery depletion, schedules weekly replenishment, and compares local stores to minimize combined delivery and item fees. It requests approval for brand swaps, enforces household budget limits, and completes checkout through PayPal Sandbox.

## Inspiration
Running out of pantry staples causes late-night emergency runs and extra delivery fees. We built an autonomous agent to manage restocks sensibly: tracking burn rates, respecting budgets, finding the cheapest multi-store basket, and requiring user approval before money moves.

## What it does
ShopPilot AI tracks pantry inventory and predicts stockouts from daily burn rates. It groups replenishments into weekly cycles to eliminate unnecessary delivery charges. Its basket optimizer evaluates simulated catalogs across Zepto, Blinkit, and Instamart, comparing four strategies: split-store item savings, single-store fee consolidation, fastest delivery, and balanced cost. A deterministic policy engine enforces spending caps and flags substitutions for approval. Once confirmed, checkout completes through PayPal Sandbox via PayPal JavaScript SDK buttons or a mobile QR code. Upon verified capture, pantry inventory automatically replenishes.

## How we built it
ShopPilot AI is a TypeScript monorepo. The backend uses Express, Node.js, and SQLite (`better-sqlite3`) in WAL mode. The frontend uses React 19, Vite, and Tailwind CSS. Monetary math uses integer paise to eliminate rounding errors. Store adapters simulate quick-commerce catalogs and tiered delivery fees. AI proposals remain strictly decoupled from server-side policy enforcement.

## PayPal integration
We integrated the PayPal REST API (v2) and PayPal JavaScript SDK:
- **OAuth 2.0**: Client credentials grant authenticates the backend and caches bearer tokens.
- **Orders v2 Create**: `POST /v2/checkout/orders` initiates orders with a `PayPal-Request-Id` idempotency header.
- **Buyer Approval**: Frontend renders official PayPal Buttons and a mobile QR code linking to the approval URL.
- **Orders v2 Capture**: `POST /v2/checkout/orders/{id}/capture` executes payment with server-side amount and currency checks.
- **Webhook Verification**: `POST /v1/notifications/verify-webhook-signature` cryptographically verifies incoming callback signatures.

Because PayPal Orders v2 does not support INR, we convert amounts to USD with a configurable rate and verify round-trip amounts on capture. The pantry restocks only after verified capture.

## AI integration
We used Google Gemini (`gemini-3.5-flash-lite`) via REST API for two tasks:
1. **Policy Parsing**: Translates plain-English rules into structured policy JSON.
2. **Substitutions**: Proposes in-stock alternatives when preferred brands run out, selecting strictly from server-provided candidates.

All outputs are validated with Zod. Hallucinated product IDs outside the server allow-list are rejected. If no API key is set, deterministic NLP and heuristics run locally. The AI proposes; code and the user decide.

## Challenges we ran into
- **PayPal Currency Support**: PayPal Sandbox does not accept INR in Orders v2. We calculate integer paise totals, convert to USD cents using an explicit configuration rate, and verify round-trip conversion on capture.
- **Local Webhook Verification**: PayPal cannot dispatch webhooks directly to local developer ports. We combined status polling with production webhook signature verification.
- **Cart Consistency**: Reconciling optimizer estimates with saved database lines across screen changes required unifying cart math in shared pure services.
- **Production Bundling**: Configuring `esbuild` for Node 20 with native SQLite addons required marking native packages external.

## Accomplishments
- Delivered a full autonomous restocking loop: depletion forecasting, multi-store fee optimization, approvals, and verified PayPal capture.
- Built an immutable audit log recording clock advances, policy proposals, approvals, and captures.
- Maintained strict boundaries separating AI proposals from financial execution.

## What we learned
- Multi-store delivery fees often outweigh item savings; single-store consolidation frequently beats splitting orders across stores.
- Autonomous agents require strict boundaries: schema validation, candidate allow-lists, and human approvals ensure reliable behavior.

## What's next
- Real grocery store API partnerships when available.
- Receipt OCR for automatic pantry updates.
- Multi-user household accounts with shared approvals.
- PayPal Vault integration for pre-authorized recurring restocks.

## Built with
Node.js, Express, TypeScript, React 19, Vite, Tailwind CSS, SQLite, better-sqlite3, Zod, bcryptjs, Vitest, Lucide React, Google Gemini API, PayPal REST API, PayPal JavaScript SDK.

## Tools used and how
- **Google Gemini API (`gemini-3.5-flash-lite`)**: Parses natural language household rules and ranks in-stock product substitutions from server candidate lists.
- **PayPal OAuth 2.0 API (`/v1/oauth2/token`)**: Authenticates the backend service with PayPal Sandbox using client credentials.
- **PayPal Orders v2 Create API (`/v2/checkout/orders`)**: Initiates payable checkout orders with idempotent request IDs.
- **PayPal Orders v2 Capture API (`/v2/checkout/orders/{id}/capture`)**: Executes authorized payments and returns verified settlement status.
- **PayPal Webhook Verification API (`/v1/notifications/verify-webhook-signature`)**: Cryptographically verifies webhook payloads using PayPal certificates.

## Try it out links
- **Live demo**: [[HOSTED_DEMO_URL]]
- **Demo video**: [[YOUTUBE_URL]]
- **GitHub repository**: [[GITHUB_URL]]

## Testing instructions for judges
1. Open [[HOSTED_DEMO_URL]].
2. Click **Instant Demo** on the landing page to enter as the guest household.
3. Open the **Time Machine** drawer and click **+3 Days** to advance simulated time.
4. On **Home**, see depleted items trigger restock warnings and populate the upcoming order bucket.
5. In **Approvals**, review and approve proposed brand substitutions.
6. Return to **Home** to view the **Store Comparison** matrix optimizing fees across Zepto, Blinkit, and Instamart.
7. Click **Confirm and Pay for Order**, then complete checkout using sandbox buyer credentials:
   - [[SANDBOX_BUYER_CREDENTIALS]]
8. Confirm that the pantry replenishes upon capture and view the settled receipt in **Activity**.
