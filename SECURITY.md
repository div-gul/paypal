# Security

## Protected

- Private API routes require an HTTP-only cookie session; production cookies are Secure, SameSite=Lax and expire after seven days.
- User-owned records are queried by authenticated user ID. Payment capture uses the stored order and run, verifies the completed capture amount/currency/order ID, and finalizes the receipt, run, pantry update and audit entry in a SQLite transaction.
- State-changing browser requests require the configured application origin. API input is JSON-limited to 100 KB and validated with Zod.
- The server uses per-IP/per-user in-memory request limits, explicit CORS, a restrictive Content Security Policy, and standard security response headers.
- Production does not seed or accept the shared development guest account. Live PayPal payments require `PAYPAL_MODE=live`, the official live API host, and `ALLOW_LIVE_PAYMENTS=true`.
- PayPal client secrets and provider tokens remain server-side. The browser receives only checkout mode, client ID and currency.

## Simulated behavior

- Grocery prices, stock, basket optimization and fulfillment are local simulations; ShopPilot does not place grocery orders with the named stores.
- `PAYPAL_MODE=mock` simulates checkout. `PAYPAL_MODE=sandbox` uses PayPal test accounts and does not move real funds. Live payments can be enabled only with the explicit configuration above.
- PayPal webhook callbacks are disabled in mock mode. Sandbox and live callbacks require PayPal signature verification and a recent transmission timestamp.
- AI parsing and substitutions currently use deterministic local fallback behavior; no external model integration is configured in this repository.

## Limitations and operator checklist

- Rate-limit counters are in memory for a single backend instance. They reset on restart and are not shared across multiple instances; use a shared Redis store before horizontal scaling.
- SQLite is local to the configured runtime path. Confirm Render persistence/backup settings for the deployed service.
- Email verification, password reset, Google OAuth, account deletion and data export are not implemented.
- Before deployment, set `NODE_ENV=production`, HTTPS `APP_BASE_URL` and `PUBLIC_APP_URL`, sandbox credentials and webhook ID, and keep `ALLOW_LIVE_PAYMENTS=false` unless real charges are deliberately intended. Rotate any credential that may have been exposed outside the server.
- Run the backend/frontend dependency audits and security checks before each public release.
- The curl smoke checks and their local setup are documented in `docs/security-checks.md`.

## Reporting an issue

Do not publish credentials, personal data or an exploit against a live deployment. Report security issues privately to the project maintainers with a description, impact and reproduction steps.
