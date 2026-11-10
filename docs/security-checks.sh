#!/usr/bin/env bash
set -u

# Smoke checks for a running ShopPilot backend. See docs/security-checks.md for setup.
BASE_URL="${BASE_URL:-http://localhost:3001}"
BASE_URL="${BASE_URL%/}"
FAILURES=0
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() { printf 'FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
pass() { printf 'PASS  %s\n' "$1"; }

for tool in curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$tool" >&2
    exit 2
  fi
done
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  printf 'Missing required command: node.\n' >&2
  exit 2
fi

if [[ -z "${SECURITY_USER_A_EMAIL:-}" || -z "${SECURITY_USER_A_PASSWORD:-}" || \
      -z "${SECURITY_USER_B_EMAIL:-}" || -z "${SECURITY_USER_B_PASSWORD:-}" || \
      -z "${SECURITY_RUN_ID:-}" ]]; then
  cat >&2 <<'USAGE'
Set SECURITY_USER_A_EMAIL, SECURITY_USER_A_PASSWORD,
SECURITY_USER_B_EMAIL, SECURITY_USER_B_PASSWORD, and SECURITY_RUN_ID.
The run ID must belong to user A. Use dedicated test accounts.
USAGE
  exit 2
fi

login() {
  local email="$1" password="$2" jar="$3" payload status
  payload="$(SECURITY_EMAIL="$email" SECURITY_PASSWORD="$password" "$NODE_BIN" -e 'process.stdout.write(JSON.stringify({email:process.env.SECURITY_EMAIL,password:process.env.SECURITY_PASSWORD}))')"
  status="$(curl -sS -o "$TMP_DIR/login.json" -w '%{http_code}' \
    -c "$jar" -H 'Content-Type: application/json' \
    --data "$payload" "$BASE_URL/api/auth/login")" || return 1
  [[ "$status" == 200 ]]
}

if ! login "$SECURITY_USER_A_EMAIL" "$SECURITY_USER_A_PASSWORD" "$TMP_DIR/a.cookies"; then
  printf 'Could not authenticate test user A.\n' >&2
  exit 2
fi
if ! login "$SECURITY_USER_B_EMAIL" "$SECURITY_USER_B_PASSWORD" "$TMP_DIR/b.cookies"; then
  printf 'Could not authenticate test user B.\n' >&2
  exit 2
fi

# Anonymous state access must not disclose private user data.
status="$(curl -sS -o "$TMP_DIR/unauth.json" -w '%{http_code}' "$BASE_URL/api/state")"
if [[ "$status" == 401 ]]; then pass 'unauthenticated /api/state returns 401'; else fail "unauthenticated /api/state returned $status (expected 401)"; fi

# User B must not be able to read a run owned by user A.
status="$(curl -sS -o "$TMP_DIR/idor.json" -w '%{http_code}' \
  -b "$TMP_DIR/b.cookies" "$BASE_URL/api/runs/$SECURITY_RUN_ID")"
if [[ "$status" == 404 ]]; then pass 'cross-user run access returns 404'; else fail "cross-user run access returned $status (expected 404)"; fi

# Eleven valid AI requests should exceed the per-user limit of ten per minute.
# Start the backend with LLM_API_KEY=mock so this check stays local and free.
rate_status=''
for _ in $(seq 1 11); do
  rate_status="$(curl -sS -o "$TMP_DIR/ai.json" -w '%{http_code}' \
    -b "$TMP_DIR/b.cookies" -H 'Content-Type: application/json' \
    --data '{"prompt":"Set the budget to 3000 rupees"}' "$BASE_URL/api/ai/parse-policy")" || rate_status='000'
  [[ "$rate_status" == 429 ]] && break
  if [[ "$rate_status" != 200 ]]; then break; fi
done
if [[ "$rate_status" == 429 ]] && "$NODE_BIN" -e 'const fs=require("fs");process.exit(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).error?.code==="RATE_LIMITED"?0:1)' "$TMP_DIR/ai.json"; then
  pass 'AI rate limit returns 429 with RATE_LIMITED'
else
  fail "AI rate limit ended with HTTP ${rate_status:-unknown} (expected 429)"
fi

# Mock mode has no PayPal callback; sandbox/live mode must reject this forged signature.
mode="$(curl -sS -b "$TMP_DIR/b.cookies" "$BASE_URL/api/checkout/config" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.parse(s).mode||"unknown"))')"
now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
event_id="security-check-$(date +%s)-$$"
webhook="$(SECURITY_EVENT_ID="$event_id" "$NODE_BIN" -e 'process.stdout.write(JSON.stringify({id:process.env.SECURITY_EVENT_ID,event_type:"PAYMENT.CAPTURE.COMPLETED",resource:{id:"forged-capture",supplementary_data:{related_ids:{order_id:"forged-order"}}}}))')"
status="$(curl -sS -o "$TMP_DIR/webhook.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -H "Paypal-Transmission-Id: $event_id" \
  -H "Paypal-Transmission-Time: $now" \
  -H 'Paypal-Transmission-Sig: forged-signature' \
  -H 'Paypal-Auth-Algo: SHA256withRSA' \
  -H 'Paypal-Cert-Url: https://example.invalid/cert.pem' \
  --data "$webhook" "$BASE_URL/api/webhooks/paypal")"
if [[ "$status" == 401 ]]; then
  pass "forged PayPal webhook rejected in $mode mode"
else
  fail "forged PayPal webhook returned $status in $mode mode (expected 401)"
fi

# The JSON parser must reject requests larger than the configured 100 KB limit.
head -c 102401 /dev/zero | tr '\000' 'x' > "$TMP_DIR/oversize.body"
status="$(curl -sS -o "$TMP_DIR/oversize.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary "@$TMP_DIR/oversize.body" \
  "$BASE_URL/api/auth/login")"
if [[ "$status" == 413 ]]; then pass 'oversized request body returns 413'; else fail "oversized request body returned $status (expected 413)"; fi

# Verify required response headers and the removed Express version header.
curl -sS -D "$TMP_DIR/headers.txt" -o /dev/null "$BASE_URL/api/health"
for header in 'content-security-policy:' 'referrer-policy: strict-origin-when-cross-origin' \
              'x-content-type-options: nosniff' 'x-frame-options: DENY'; do
  if grep -Eiq "^${header}" "$TMP_DIR/headers.txt"; then pass "security header present: ${header%%:*}"; else fail "security header missing: ${header%%:*}"; fi
done
if grep -Eiq '^x-powered-by:' "$TMP_DIR/headers.txt"; then fail 'X-Powered-By header is present'; else pass 'X-Powered-By header is absent'; fi

if [[ "$FAILURES" -gt 0 ]]; then
  printf '\n%d security check(s) failed.\n' "$FAILURES"
  exit 1
fi
printf '\nAll security smoke checks passed.\n'
