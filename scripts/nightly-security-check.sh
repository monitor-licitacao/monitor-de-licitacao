#!/bin/bash

# Nightly Security Validation: IDOR + Auth
# Fase 0 → Fase 1 gate validation

set -e

API_URL="${API_URL:-http://localhost:3001}"

# Dynamically acquire a fresh test token if not explicitly provided
TEST_TOKEN="${TEST_TOKEN:-}"
if [ -z "$TEST_TOKEN" ]; then
  TEST_EMAIL="${TEST_EMAIL:-}"
  TEST_PASSWORD="${TEST_PASSWORD:-}"
  if [ -z "$TEST_EMAIL" ] && [[ "$API_URL" == http://localhost:* || "$API_URL" == http://127.0.0.1:* ]]; then
    TEST_EMAIL="test@example.com"
    TEST_PASSWORD="password123"
  fi
  if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
    echo "✗ FAIL: Set TEST_TOKEN or both TEST_EMAIL and TEST_PASSWORD for $API_URL." >&2
    exit 1
  fi
  LOGIN_PAYLOAD=$(TEST_EMAIL="$TEST_EMAIL" TEST_PASSWORD="$TEST_PASSWORD" python3 -c 'import json,os; print(json.dumps({"email": os.environ["TEST_EMAIL"], "password": os.environ["TEST_PASSWORD"]}))')
  LOGIN_RESP=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$LOGIN_PAYLOAD" \
    "$API_URL/api/auth/login" 2>/dev/null || true)
  DYNAMIC_TOKEN=$(python3 -c 'import json,sys
try:
  print(json.load(sys.stdin).get("token", ""))
except Exception:
  print("")' <<<"$LOGIN_RESP" 2>/dev/null || true)
  if [ -n "$DYNAMIC_TOKEN" ]; then
    TEST_TOKEN="$DYNAMIC_TOKEN"
  else
    echo "✗ FAIL: Could not acquire TEST_TOKEN from $API_URL/api/auth/login. Set TEST_TOKEN or ensure the server is running with JWT_SECRET." >&2
    exit 1
  fi
fi

echo "🔐 Nightly Security Validation — $(date)"
echo "────────────────────────────────────────"

# Test 1: Auth guard — no token = 401
echo "✓ Test 1: No token → 401"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/sources")
if [ "$STATUS" = "401" ]; then
  echo "  ✓ PASS: No token rejected (401)"
else
  echo "  ✗ FAIL: Expected 401, got $STATUS"
  exit 1
fi

# Test 2: Auth guard — invalid token = 401
echo "✓ Test 2: Invalid token → 401"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: invalid-token" \
  "$API_URL/api/sources")
if [ "$STATUS" = "401" ]; then
  echo "  ✓ PASS: Invalid token rejected (401)"
else
  echo "  ✗ FAIL: Expected 401, got $STATUS"
  exit 1
fi

# Test 3: Auth guard — valid token = 200/500 (not 401)
echo "✓ Test 3: Valid token → 200/500 (auth passes)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_URL/api/sources")
if [ "$STATUS" != "401" ]; then
  echo "  ✓ PASS: Valid token accepted (got $STATUS, not 401)"
else
  echo "  ✗ FAIL: Valid token rejected with 401"
  exit 1
fi

# Test 4: Health check — public endpoint
echo "✓ Test 4: Health check (public) → 200"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
if [ "$STATUS" = "200" ]; then
  echo "  ✓ PASS: Health check public"
else
  echo "  ✗ FAIL: Expected 200, got $STATUS"
  exit 1
fi

# Test 5: Login endpoint — public
echo "✓ Test 5: Login endpoint (public) → accessible (not blocked)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  "$API_URL/api/auth/login")
if [ "$STATUS" != "403" ] && [ "$STATUS" != "404" ]; then
  echo "  ✓ PASS: Login accessible (got $STATUS, not 403/404)"
else
  echo "  ✗ FAIL: Login blocked with $STATUS"
  exit 1
fi

# Test 6: IDOR Protection — legitimate tenant access allowed
echo "✓ Test 6: IDOR guard — legitimate tenant access"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_URL/api/config/tenant/pncp")
if [ "$STATUS" = "200" ]; then
  echo "  ✓ PASS: Legitimate tenant access allowed (200)"
else
  echo "  ✗ FAIL: Expected 200, got $STATUS"
  exit 1
fi

# Test 7: IDOR Protection — cross-tenant injection rejected (403)
echo "✓ Test 7: IDOR guard — cross-tenant query injection rejected (403)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_URL/api/config/tenant/pncp?tenantId=999")
if [ "$STATUS" = "403" ]; then
  echo "  ✓ PASS: Cross-tenant access blocked with 403 Forbidden"
else
  echo "  ✗ FAIL: Expected 403 Forbidden, got $STATUS"
  exit 1
fi

echo ""
echo "✅ All security checks passed."
echo "   Incident CLOSED: Auth guard + IDOR gate ready for Fase 1"
