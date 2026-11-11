# Security policy

## Protected controls

- Private API routes require an authenticated HTTP-only cookie session (`auth_sessions`); production session cookies use `SameSite=Lax`, `Secure`, and expire after seven days.
- User-owned records are scoped strictly by authenticated user ID in SQL queries across all repositories.
- Payment capture uses the stored restock order and run ID, validates the completed capture amount and currency against the approved total, and atomically updates the receipt, run status, pantry inventory, and audit log inside a single SQLite transaction.
- State-changing browser requests require origin verification matching `PUBLIC_APP_URL` / `APP_BASE_URL`. API JSON payloads are capped at 100 KB and validated with Zod schemas.
- In-memory rate limiting is applied to authentication, checkout creation, AI operations, time advancement, and unauthenticated traffic.
- Security headers are enforced on all responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, Content Security Policy (CSP) restricting scripts/frames/connect to PayPal and Google OAuth origins, and HSTS in production.
- Production environments reject guest account logins (`INVALID_CREDENTIALS`).
- Live PayPal charges are blocked unless `PAYPAL_MODE=live`, `ALLOW_LIVE_PAYMENTS=true`, and the live PayPal API origin are all explicitly configured.
- PayPal client secrets remain strictly server-side. The client receives only checkout mode, client ID, and currency.
- Account management provides user data export (`GET /api/auth/export`) and cascading account deletion (`DELETE /api/auth/account`).

## Simulated behavior and boundaries

- Grocery prices, catalog availability, delivery fees, and order fulfillment are simulated from seeded local catalog data. No orders are placed with external grocery merchants.
- `PAYPAL_MODE=mock` simulates checkout without contacting PayPal. `PAYPAL_MODE=sandbox` communicates with the official PayPal Sandbox API (`api-m.sandbox.paypal.com`) and moves no real currency.
- PayPal webhook verification requires valid PayPal transmission headers and verification through PayPal's signature verification API (`/v1/notifications/verify-webhook-signature`). Webhooks are disabled in mock mode.
- AI features use Google Gemini (`gemini-3.5-flash-lite`) when `LLM_API_KEY` is provided, with Zod schema validation and a server-side catalog allow-list to reject hallucinated products. If `LLM_API_KEY` is empty, deterministic NLP and heuristic rules execute locally.

## Limitations and operator checklist

- Rate limit counters are stored in server memory. Counters reset upon process restart and do not coordinate across multiple backend instances. A centralized store (such as Redis) is required before horizontal scaling.
- SQLite database storage relies on the local file path. On cloud hosts such as Render, a persistent disk mount must be attached to retain data across deploys and restarts.
- Real PayPal Sandbox webhook verification requires a publicly accessible HTTPS endpoint or an HTTPS tunnel, because PayPal cannot dispatch callbacks directly to local private addresses.
- Automated tests run against mock payment providers and in-memory databases to ensure test isolation and prevent dependency on external network services.

## Reporting an issue

Do not post security vulnerabilities, credentials, or personal data to public issues or pull requests. Report security concerns privately to the project maintainers with reproduction steps and impact details.
