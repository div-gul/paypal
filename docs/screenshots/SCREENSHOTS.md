# Screenshot Capture Guidelines

All screenshots should be captured at 1440×900 viewport resolution with clean demo state to illustrate the user flow.

## Required Screenshots

| Name | Screen / Component | State / Context | Viewport | What to Blur / Redact |
|---|---|---|---|---|
| `home-order-card` | Home dashboard (`/`) | Seeded guest account with upcoming order bucket populated, depletion warning on Milk, and strategy badge | 1440×900 | Any personal email if visible in header |
| `time-machine-drawer` | Time Machine slide-out drawer | Simulation clock advanced by 3 days, showing depletion countdowns and days elapsed | 1440×900 | None |
| `approvals-swaps` | Approvals view (`/approvals`) | Pending brand substitution card (e.g. Quaker Oats vs Kellogg's Oats) showing price comparison and reasoning | 1440×900 | None |
| `store-comparison-optimizer` | Store Comparison component | Comparison matrix of Strategy A (split stores) vs Strategy B (Zepto consolidation) with item and fee breakdowns | 1440×900 | None |
| `paypal-checkout-modal` | Checkout modal dialog | PayPal Sandbox mode active, showing INR total, converted USD amount, PayPal Buttons, and approval QR code | 1440×900 | Any personal test credentials |
| `activity-audit-log` | Activity view (`/activity`) | Audit log table showing "Payment Captured", "Order Planned", and "Time Advanced" entries | 1440×900 | Test transaction IDs if sensitive |

## File Placement

Save captured PNG or WebP files in `docs/screenshots/` matching the names above (e.g. `docs/screenshots/home-order-card.png`).

