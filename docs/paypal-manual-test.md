# PayPal Sandbox End-to-End Manual Testing Guide

This guide provides step-by-step instructions for testing the real PayPal Sandbox payment flow in **ShopPilot AI**, including live checkout pop-up approval, USD currency conversion, and webhook signature verification over an ngrok or cloudflared tunnel.

---

## 1. Prerequisites

1. **PayPal Developer Account:**
   - Sign in or sign up at [developer.paypal.com](https://developer.paypal.com).
2. **Sandbox REST App Credentials:**
   - Go to **Developer Dashboard** > **Apps & Credentials** > **Sandbox**.
   - Create or select an App (e.g. `ShopPilot AI Sandbox App`).
   - Copy the **Client ID** and **Secret Key**.
3. **Sandbox Personal Buyer Account:**
   - Go to **Developer Dashboard** > **Testing Tools** > **Sandbox Accounts**.
   - Note the email address and password of a **Personal (Buyer)** account (e.g., `sb-buyerXXXXX@personal.example.com`).
   - Ensure the buyer account has test balance/funds in USD.

---

## 2. Environment Configuration (`.env`)

In your repository root, create or edit `.env` (refer to `.env.example`).

> [!WARNING]
> Never commit your `.env` file to version control. It is already included in `.gitignore`.

```bash
# Server Port
PORT=3001

# PayPal Sandbox Mode Configuration
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_WEBHOOK_ID=your_webhook_id_here   # Set after setting up tunnel in Section 3
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_USD_RATE=85
PUBLIC_APP_URL=http://localhost:5173
```

---

## 3. Webhook Tunneling (ngrok or cloudflared)

PayPal webhooks require an HTTPS callback endpoint reachable from PayPal's servers.

### Using ngrok:
1. Start an HTTP tunnel to port 3001:
   ```bash
   ngrok http 3001
   ```
2. Copy the forwarding HTTPS URL, e.g.:
   `https://a1b2-c3d4.ngrok-free.app`
3. Configure PayPal Webhook in the Developer Dashboard:
   - Go to **Apps & Credentials** > Select your Sandbox App > Scroll to **Webhooks** > **Add Webhook**.
   - **Webhook URL:** `https://a1b2-c3d4.ngrok-free.app/api/webhooks/paypal`
   - **Event Types to Subscribe:**
     - `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`)
     - `Payment capture denied` (`PAYMENT.CAPTURE.DENIED`)
   - Click **Save**.
4. Copy the generated **Webhook ID** and paste it into your `.env`:
   ```bash
   PAYPAL_WEBHOOK_ID=9WH12345ABC67890
   ```

*(Alternative using Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3001` and register the generated trycloudflare HTTPS URL)*

---

## 4. Step-by-Step Checkout Walkthrough

### Step 1: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 2: Trigger a Restock Run
- Use the **Time Machine** on the dashboard to advance time by **1, 3, or 7 days**, or adjust a pantry item (e.g., Milk) below its minimum threshold.
- The system will detect impending stockouts and generate a shopping plan.

### Step 3: Review and Approve Policy Items
- If any items are flagged with brand substitutions or budget caps requiring approval, navigate to the **Approvals** tab and confirm them.
- Once the restock run status is `approved` or `auto_approved`, checkout is unlocked.

### Step 4: Open Checkout Modal
- Click **Checkout** / **Review & Pay**.
- The **CheckoutModal** opens:
  - Primary amount displays in **INR** (e.g. `₹935.35`).
  - Secondary amount displays in **USD** (e.g. `$11.01 USD` at ₹85/$1).
  - Notice explains that PayPal Sandbox authorizes the transaction in USD.
  - The live **PayPal Buttons** render inside `#paypal-button-container`.

### Step 5: Pay via PayPal Sandbox Pop-up
- Click the yellow **PayPal** button.
- A PayPal modal/pop-up appears loading `sandbox.paypal.com`.
- Log in with your **Sandbox Personal Buyer** email and password.
- Review the purchase in USD (the purchase description will read `ShopPilot AI Restock Run <run-id>`).
- Click **Complete Purchase** / **Pay Now**.

### Step 6: Verify Settlement & Restocked Pantry
- The PayPal pop-up closes.
- The `onApprove` handler captures the payment atomically via `POST /api/checkout/capture`.
- The modal instantly transitions to the **Order & Payment Settled** receipt view displaying:
  - **Transaction Order ID** (e.g. `5XX12345YY67890Z`)
  - **PayPal Capture ID** (e.g. `2AA12345BB67890C`)
  - **Total Settled** in both INR and USD
  - **Payer Account Email**
  - **Pantry Replenishment Details**
- Click **Back to Pantry**: notice all purchased items are now replenished to their target stocks!

### Step 7: Verify Database & Audit Log
1. **Receipts Table:**
   - In SQLite (`./data/shoppilot.db`), inspect the `receipts` table:
     ```sql
     SELECT id, order_id, paypal_capture_id, amount_paise, usd_amount, usd_rate, payer_email, status FROM receipts ORDER BY created_at DESC LIMIT 1;
     ```
   - Shows the captured transaction with `usd_amount`, `usd_rate`, `inr_paise`, and `payer_email`.
2. **Audit Log:**
   - View the **Activity Log** in the dashboard: contains a `checkout_completed` entry with the captured Order ID and timestamp.
3. **PayPal Developer Dashboard:**
   - Go to **Developer Dashboard** > **Testing Tools** > **Sandbox Accounts** > Personal Buyer > **Notifications** or log into [sandbox.paypal.com](https://www.sandbox.paypal.com) to view the debit transaction activity.

---

## 5. Troubleshooting Common Errors

### 1. `CURRENCY_NOT_SUPPORTED`
- **Cause:** Attempting to charge INR directly on PayPal Sandbox. PayPal Sandbox does not support INR merchant accounts.
- **Resolution:** ShopPilot AI automatically converts all INR paise amounts to USD via `paiseToUsd(paise, rate)` rounding up to the nearest cent before calling `/v2/checkout/orders`. The exchange rate is configurable via `PAYPAL_USD_RATE` in `.env` (default: 85).

### 2. `401 INVALID_CLIENT` / `PAYPAL_AUTH_FAILED`
- **Cause:** Invalid Client ID or Client Secret in `.env`.
- **Resolution:** Verify you copied the credentials from the **Sandbox** tab (not Live) in the PayPal Developer Dashboard. Ensure there are no surrounding whitespace or quotes.

### 3. `ORDER_ALREADY_CAPTURED` (HTTP 422)
- **Resolution:** ShopPilot AI handles this automatically. If a capture request receives `ORDER_ALREADY_CAPTURED`, the `PayPalSandboxProvider` automatically retrieves the order status via `GET /v2/checkout/orders/{id}` and treats `COMPLETED` as success without failing the user.

### 4. `401 INVALID_SIGNATURE` on Webhooks
- **Cause:** Webhook request transmission headers mismatch or ngrok tunnel URL changed without updating the webhook registration in PayPal Dashboard.
- **Resolution:**
  - Verify that `PAYPAL_WEBHOOK_ID` in `.env` matches the ID in the PayPal Developer Dashboard.
  - If using ngrok without a fixed domain, re-register the new ngrok URL whenever restarting ngrok.
  - In local development without an active tunnel, leaving `PAYPAL_WEBHOOK_ID` empty will safely allow webhook tests to pass with a dev warning.
