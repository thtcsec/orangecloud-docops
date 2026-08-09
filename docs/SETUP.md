# OrangeCloud DocOps — Environment Setup

## Prerequisites

- Node.js 22+
- npm 10+
- Cloudflare account **Cloudspace** (`4c15704ef706b9c8954cd6f9feb678d8`)
- Wrangler authenticated (`npx wrangler login`)
- Set account for remote commands:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "4c15704ef706b9c8954cd6f9feb678d8"
```

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local   # optional synthetic data
npm run dev
```

Open `http://localhost:5173`.

Local auth is explicit:

- Only active when `ENVIRONMENT=local` **and** `LOCAL_DEV_AUTH_ENABLED=true`
- Identity comes from `.dev.vars` (`LOCAL_DEV_AUTH_EMAIL`, `LOCAL_DEV_AUTH_ROLE`)
- Never enabled as a silent production fallback

## Provisioned Cloudflare resources (Cloudspace)

Already created and wired in `wrangler.jsonc`:

| Resource | Staging | Production |
|----------|---------|------------|
| D1 | `orangecloud-docops-stg` (`62142462-5a04-436c-bde4-ae217c7296ba`) | `orangecloud-docops-prod` (`6fe291d1-7f8f-4881-b49b-c9e85523ccf1`) |
| R2 | `orangecloud-docops-documents-stg` | `orangecloud-docops-documents-prod` |
| Queue | `orangecloud-docops-processing-stg` | `orangecloud-docops-processing-prod` |
| DLQ | `orangecloud-docops-processing-dlq-stg` | `orangecloud-docops-processing-dlq-prod` |

Buckets are **private** (no public access). Do not enable public R2.

### R2 event notifications → Queue (optional)

Upload already enqueues a metadata-only message. Optional R2→Queue notifications are fine as long as payloads stay metadata-only; queue idempotency prevents duplicate side effects.

### Custom Domains

`wrangler.jsonc` declares:

- staging: `docops-stg.orangecloud.vn`
- production: `docops.orangecloud.vn`

DNS / zone must live on the same Cloudflare account. Do not overwrite incompatible records.

### Cloudflare Access (required before real users)

Staging/production **refuse** authenticated API use until secrets exist (`readiness.accessConfigured` on `/api/health`).

Ops UI lives under **`/app/*`**. Public marketing stays at `/` and `/privacy`.

#### Recommended Application (production)

One Access app, **two protect destinations** (+ health bypass for probes):

| Subdomain | Domain | Path | Policy |
|-----------|--------|------|--------|
| `docops` | `orangecloud.vn` | `/app*` | **Allow** (team emails / IdP) — leading `/` matters |
| `docops` | `orangecloud.vn` | `/api*` | **Allow** (same policy) |
| `docops` | `orangecloud.vn` | `/api/health` | **Bypass** (higher priority than `/api*`) |

Leave public (no Access destination): `/`, `/privacy`, `/assets*`, `/illustrations*`, and the SPA kickoff is fine behind `/api*` (`/api/auth/start`).

Wrangler must set `assets.run_worker_first: ["/api/*"]`. Without it, a full-page click to `/api/auth/start` is treated as an SPA navigation (`Sec-Fetch-Mode: navigate`), `index.html` is served, and the client catch-all sends you back to `/`.

Without the Bypass row, `/api/health` returns the Access login HTML instead of JSON — fine for browsers, broken for uptime monitors.

Landing CTA and the in-app “Sign in with Access” button navigate to **`/api/auth/start?next=/app/dashboard`**. That forces an Access challenge even when `/app*` is misconfigured, then redirects into the SPA with `CF_Authorization` set. Old paths like `/dashboard` redirect into `/app/...`.

Repeat for staging (`docops-stg…`) when you enable Access there.

#### Secrets

1. Copy Application Audience (AUD) + team name (`cloudspacevn`).
2. Put secrets:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "4c15704ef706b9c8954cd6f9feb678d8"
$env:CF_ACCESS_TEAM_DOMAIN = "<team>"   # e.g. cloudspacevn (no .cloudflareaccess.com)
$env:CF_ACCESS_AUD_STAGING = "<aud>"
$env:CF_ACCESS_AUD_PRODUCTION = "<aud>"
pwsh -File scripts/put-access-secrets.ps1
```

Or manually:

```bash
npx wrangler secret put CF_ACCESS_AUD --env staging
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env staging
npx wrangler secret put CF_ACCESS_AUD --env production
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env production
```

3. Bootstrap admin: production already has `BOOTSTRAP_ADMIN_EMAILS`. First Access login otherwise maps to **viewer**; elevate in D1 if needed.

### Hardening already in Worker

- Local auth disabled outside `ENVIRONMENT=local`
- Strict CORS to `APP_BASE_URL` on staging/prod
- Security headers (CSP, HSTS, frame deny, nosniff, …)
- Workers Rate Limiting bindings on API + upload (`Retry-After` on 429)
- Access JWKS cached (isolate memory + Cache API, 10m TTL)
- Additive D1 indexes for hot list / duplicate / audit queries
- `/api/health` probes D1 with `SELECT 1` (returns 503 when degraded)
- Request timing via `x-response-time` + structured `request_completed` logs
- Observability enabled
- Queue retries + DLQ
- Fail-closed when Access secrets missing

### Queue DLQ triage

Failed processing messages land on:

- staging: `orangecloud-docops-processing-dlq-stg`
- production: `orangecloud-docops-processing-dlq-prod`

When DLQ depth grows:

1. Check Worker logs for `queue` / `workflow` errors (`requestId`, `documentId`).
2. Confirm D1 migrations applied (`npm run db:migrate:production`).
3. Reprocess from the document detail UI (`Run again`) after the root cause is fixed.
4. Do not purge DLQ blindly — messages are metadata-only but still needed for forensics.

### Workers AI

The `AI` binding is declared for future extraction. Current pipeline uses deterministic XML parsing + rules only.

## Migrations

```bash
npm run db:migrate:local
npm run db:migrate:staging
# Production only when intentionally releasing:
npm run db:migrate:production
```

Always migrate **before or immediately after** deploying schema-dependent Worker changes.

## Validation

```bash
npm run ci
```

`/api/health` returns `readiness` for bindings + Access. Prefer HTTP 200 + `status: "ok"`; `503` + `status: "degraded"` means a binding probe failed (often D1).

## Deployment

Staging:

```bash
npm run deploy:staging
npm run db:migrate:staging
```

Production (manual only):

```bash
npm run deploy:production
npm run db:migrate:production
```

`workers_dev` is disabled for staging and production.
