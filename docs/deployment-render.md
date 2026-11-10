# Deploying ShopPilot AI to Render

This guide provides step-by-step instructions for deploying ShopPilot AI to [Render](https://render.com) with secure HTTPS, persistent SQLite storage, PayPal Sandbox, Google OAuth, and SMTP email delivery.

---

## Architecture Overview

ShopPilot AI runs as a unified Node.js service on Render:
- **Backend:** Express API server running on Node 20.
- **Frontend:** React + Vite single-page application compiled into `frontend/dist` and served statically by the backend with client-side routing fallback.
- **Database:** SQLite running via `better-sqlite3` on a Render Persistent Disk (`/var/data/shoppilot.db`).
- **Payments:** PayPal Sandbox with strict server-side order derivation, capture validation, and webhook signature verification (`ALLOW_LIVE_PAYMENTS=false`).

---

## 1. Prerequisites & Blueprints Setup

1. Push your repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com), click **New** > **Blueprint**.
3. Connect your repository. Render will automatically detect the [`render.yaml`](../render.yaml) file in the root directory.
4. Review the service definition:
   - **Service Type:** Web Service
   - **Plan:** `Starter` (Required for Persistent Disks — free Render instances use ephemeral storage where files are erased on restart).
   - **Disk:** `shoppilot-data` mounted at `/var/data` (1 GB).

---

## 2. Environment Variables & Secret Configuration

Configure the following environment variables in the Render Dashboard under **Environment**:

| Variable | Recommended Render Value | Purpose / Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security headers, HSTS, and secure cookies. |
| `PORT` | `3001` | Application listening port. |
| `DATABASE_PATH` | `/var/data/shoppilot.db` | Points SQLite to the persistent disk mount path. |
| `APP_BASE_URL` | `https://shoppilot-ai.onrender.com` | Primary URL used for reset/verification links and CORS. |
| `PUBLIC_APP_URL` | `https://shoppilot-ai.onrender.com` | Allowed origin for browser API requests. |
| `PAYPAL_MODE` | `sandbox` | **Must be `sandbox` or `mock`.** |
| `ALLOW_LIVE_PAYMENTS` | `false` | **Enforced safety lock.** Prevents live financial transactions. |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` | PayPal Sandbox API endpoint. |
| `PAYPAL_CURRENCY` | `INR` (or `USD`) | Currency code for orders. If `USD`, specify `PAYPAL_INR_PER_USD`. |
| `PAYPAL_CLIENT_ID` | `<from PayPal Developer>` | Sandbox REST app Client ID. |
| `PAYPAL_CLIENT_SECRET` | `<from PayPal Developer>` | Sandbox REST app Client Secret. |
| `PAYPAL_WEBHOOK_ID` | `<from PayPal Developer>` | Webhook ID created for capture events. |
| `GOOGLE_CLIENT_ID` | `<from Google Cloud Console>` | OAuth 2.0 Web Client ID (optional). |
| `GOOGLE_CLIENT_SECRET` | `<from Google Cloud Console>` | OAuth 2.0 Client Secret (optional). |
| `LLM_API_KEY` | `<Gemini / OpenAI API Key>` | Used for natural language restock rule parsing (optional). |
| `SMTP_HOST` | `smtp.sendgrid.net` (or SES/Resend) | Outbound SMTP server for verification & reset emails. |
| `SMTP_PORT` | `587` | SMTP port (typically 587 for STARTTLS). |
| `SMTP_SECURE` | `false` | Set to `true` only for port 465 (SSL/TLS direct). |
| `SMTP_USER` | `<SMTP Username / API Key>` | SMTP credentials. |
| `SMTP_PASS` | `<SMTP Password / API Key>` | SMTP credentials. |
| `EMAIL_FROM` | `ShopPilot AI <no-reply@yourdomain.com>` | Verified sender address. |

---

## 3. HTTPS & Reverse Proxy Settings

- **Edge TLS Termination:** Render automatically provisions and renews Let's Encrypt SSL/TLS certificates for `*.onrender.com` and custom domains.
- **Express Trust Proxy:** ShopPilot AI configures `app.set('trust proxy', 1)`. This ensures:
  - Cookie sessions set the `Secure` attribute correctly when served over HTTPS.
  - Rate limiters accurately track client IPs from `X-Forwarded-For` rather than the Render internal router IP.
  - HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains`) is sent in production.
- **Allowed Origins:** `app.use(cors(...))` and state-changing route guards only accept requests matching `APP_BASE_URL` / `PUBLIC_APP_URL`. If you add a custom domain, update both variables in the Render Dashboard.

---

## 4. SQLite Persistence & Backup Strategy

### Persistent Disk
- Render persistent disks are mounted at `/var/data` and persist across deploys, instance restarts, and scale events.
- WAL (Write-Ahead Logging) mode is activated automatically by the backend database connector.

### Backup Strategy
Because SQLite is stored in a single file on disk, you should maintain regular backups:

1. **Render Disk Snapshots:**
   - In the Render Dashboard, open the **Disks** tab for `shoppilot-data` to configure automated disk snapshots.
2. **Online SQLite Backups via Script:**
   - SQLite provides a safe online backup API that copies database pages without locking writers:
   ```bash
   sqlite3 /var/data/shoppilot.db ".backup '/var/data/shoppilot-backup-$(date +%Y%m%d).db'"
   ```
3. **Offsite Cloud Backups (Recommended for Production):**
   - Use [Litestream](https://litestream.io/) or a lightweight cron job to stream WAL frames to an Amazon S3, Cloudflare R2, or Google Cloud Storage bucket.

---

## 5. PayPal Sandbox Setup

1. Log into the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Navigate to **Apps & Credentials** and ensure **Sandbox** mode is toggled on.
3. Create a REST API app (or use the Default Application).
4. Copy the **Client ID** and **Secret** to `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in Render.
5. Create a Webhook:
   - **Webhook URL:** `https://<your-render-app>.onrender.com/api/webhooks/paypal`
   - **Event Types:** Select `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`).
6. Copy the generated **Webhook ID** to `PAYPAL_WEBHOOK_ID` in Render.

> [!NOTE]
> All incoming webhooks are cryptographically verified using PayPal's public certificates and signature headers (`paypal-transmission-sig`, `paypal-cert-url`). Unsigned or forged webhooks are rejected with `400 Bad Request`.

---

## 6. Google OAuth 2.0 Setup

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Go to **APIs & Services** > **Credentials**.
3. Create an **OAuth 2.0 Client ID** with application type **Web application**.
4. Under **Authorized JavaScript origins**, add:
   - `https://<your-render-app>.onrender.com`
   - `http://localhost:5173` (for local development)
5. Under **Authorized redirect URIs**, add:
   - `https://<your-render-app>.onrender.com`
6. Copy the **Client ID** to `GOOGLE_CLIENT_ID` and **Client Secret** to `GOOGLE_CLIENT_SECRET`.

---

## 7. Email Provider (SMTP) Setup

ShopPilot AI requires an SMTP provider for:
- Email verification links (`/verify-email?token=...`)
- Password reset links (`/reset-password?token=...`)

You can use any standard SMTP provider:
- **SendGrid:** `SMTP_HOST=smtp.sendgrid.net`, `SMTP_USER=apikey`, `SMTP_PASS=<SendGrid-API-Key>`, `SMTP_PORT=587`
- **Amazon SES:** `SMTP_HOST=email-smtp.<region>.amazonaws.com`, `SMTP_USER=<SES-Access-Key>`, `SMTP_PASS=<SES-Secret>`, `SMTP_PORT=587`
- **Resend:** `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_PASS=<Resend-API-Key>`, `SMTP_PORT=587`

> [!TIP]
> If SMTP credentials are not provided, the API continues to operate safely in mock/development mode. Sensitive tokens and links are never written to server logs.

