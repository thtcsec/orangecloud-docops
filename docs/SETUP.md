# OrangeCloud DocOps — Environment Setup

## Prerequisites

- Node.js 20+
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

**Do not protect the whole hostname.** Landing `/` and `/privacy` stay public; only the ops app + API sit behind Access.

#### Recommended Application paths (production)

Zero Trust → Access controls → Applications → edit the `docops.orangecloud.vn` app.

Replace a bare hostname destination (`docops.orangecloud.vn` with empty path) with **path-scoped** public hostnames (same AUD / policies):

| Domain | Path |
|--------|------|
| `docops.orangecloud.vn` | `dashboard*` |
| `docops.orangecloud.vn` | `documents*` |
| `docops.orangecloud.vn` | `cases*` |
| `docops.orangecloud.vn` | `review*` |
| `docops.orangecloud.vn` | `rules*` |
| `docops.orangecloud.vn` | `audit*` |
| `docops.orangecloud.vn` | `settings*` |
| `docops.orangecloud.vn` | `api*` |

Leave **public** (no Access app covering them): `/`, `/privacy`, `/assets/*`, illustrations, and other static assets.

Landing CTA uses a full navigation to `/dashboard` so Access can show the login wall (SPA client routing alone would skip Access).

Repeat the same path pattern for staging (`docops-stg.orangecloud.vn`) when you enable Access there.

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
- Workers Rate Limiting bindings on API + upload
- Observability enabled
- Queue retries + DLQ
- Fail-closed when Access secrets missing

### Workers AI

The `AI` binding is declared for future extraction. Current pipeline uses deterministic XML parsing + rules only.

## Migrations

```bash
npm run db:migrate:local
npm run db:migrate:staging
# Production only when intentionally releasing:
npm run db:migrate:production
```

## Validation

```bash
npm run ci
```

`/api/health` returns `readiness` for bindings + Access.

## Deployment

Staging:

```bash
npm run deploy:staging
```

Production (manual only):

```bash
npm run deploy:production
```

`workers_dev` is disabled for staging and production.
