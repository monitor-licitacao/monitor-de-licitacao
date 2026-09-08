# Fase 3 security - smoke validation

Quick checks for rate limiting, SSRF, CORS, and auth failure logging.
Default base URL: http://localhost:3001

## Prerequisites

- Server running (npm run dev or npm start)
- curl available

## 1. Login rate limit (brute-force)

Expect HTTP 429 after 5 failed attempts within 15 minutes (same IP):

    for i in 1 2 3 4 5 6; do
      echo "attempt $i"
      curl -s -o /dev/null -w "%{http_code}\n" \
        -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"nobody@example.com","password":"wrong"}'
    done

Also confirm server logs show [Auth] Failed login attempt with email + ip and no password.

## 2. AI / Gemini rate limit

Routes protected by aiLimiter (30 req / 15 min / IP):

- POST /api/editais/:id/analyze-ai
- POST /api/gemini/analyze-technical-specification
- GET /api/crm/revops/insights
- POST /api/crm/revops/report

With a valid JWT (or API key), burst more than 30 calls and expect 429.

## 3. SSRF on source test

Authenticated POST /api/sources/:id/test must reject private/loopback source URLs with an error containing SSRF Protection.

## 4. CORS production allowlist

Set CORS_ORIGINS to your real front-end origins (comma-separated). Do not invent domains.

- Origin not in the list -> CORS blocked
- Empty CORS_ORIGINS in production -> deny all browser cross-origin (fail-closed);
  server warns [CORS] CORS_ORIGINS is unset...

## 5. Helmet headers (sanity)

    curl -sI http://localhost:3001/api/health | grep -iE 'x-frame-options|content-security-policy|referrer-policy'

Expect X-Frame-Options: DENY (or equivalent) and CSP-related headers.
