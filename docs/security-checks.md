# Security smoke checks

Run these checks against a local, isolated test database. Do not use a production
service: the rate-limit check deliberately uses the test account's AI budget, and
the webhook check sends a forged callback.

## Prepare

1. Start the backend in local deterministic AI mode:

   ```bash
   LLM_API_KEY=mock npm --prefix backend run dev
   ```

   For webhook verification in sandbox mode, start it with the PayPal sandbox
   configuration instead. The script exercises mock-mode webhook rejection by
   default; sandbox/live verification makes an outbound request to PayPal.

2. Create two dedicated test accounts through the app's signup flow. Add pantry
   data to account A and create a run, then copy that run's ID. Do not use a run
   containing real payment data.

3. In Bash (including Git Bash), set the two test logins and run ID, then run:

   ```bash
   export BASE_URL=http://localhost:3001
   export SECURITY_USER_A_EMAIL='security-a@example.test'
   export SECURITY_USER_A_PASSWORD='use-a-test-password-here'
   export SECURITY_USER_B_EMAIL='security-b@example.test'
   export SECURITY_USER_B_PASSWORD='use-another-test-password-here'
   export SECURITY_RUN_ID='run-id-owned-by-account-a'
   bash docs/security-checks.sh
   ```

The script needs `curl` and Node.js. It logs in to both accounts, tests anonymous
access and cross-user run access, makes up to eleven policy-proposal requests to
trigger the per-user AI limit, sends a forged webhook, posts a body larger than
100 KB, and checks response headers. The AI requests only generate proposals and
do not save policy changes. The account B AI limit resets after one minute.

`BASE_URL` should point directly to the backend API. In production, HTTP/HTTPS
and HSTS behavior also depends on the trusted TLS-terminating proxy and the
deployed `NODE_ENV=production` setting; this script does not validate Render
dashboard configuration or external TLS settings.
