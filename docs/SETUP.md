# OrangeCloud DocOps — Environment Setup

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account with Workers, D1, R2, Queues, and Workflows enabled
- Wrangler authenticated (`npx wrangler login`)
- If your Wrangler login has multiple accounts, set `CLOUDFLARE_ACCOUNT_ID` in your shell for remote resource commands (do not commit the value)

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

## Create Cloudflare resources

Replace names if your account already uses them.

### D1

```bash
npx wrangler d1 create orangecloud-docops-stg
npx wrangler d1 create orangecloud-docops-prod
```

Copy each `database_id` into `wrangler.jsonc` (`env.staging` / `env.production`).

### R2

```bash
npx wrangler r2 bucket create orangecloud-docops-documents-stg
npx wrangler r2 bucket create orangecloud-docops-documents-prod
```

Do **not** enable public access on these buckets.

### Queues + DLQ

```bash
npx wrangler queues create orangecloud-docops-processing-stg
npx wrangler queues create orangecloud-docops-processing-dlq-stg
npx wrangler queues create orangecloud-docops-processing-prod
npx wrangler queues create orangecloud-docops-processing-dlq-prod
```

Queue consumers are declared in `wrangler.jsonc`.

### R2 event notifications → Queue

After buckets and queues exist, configure object-creation notifications to the processing queue (dashboard or Wrangler event subscriptions). Payload must contain object metadata/keys only — never file bodies.

Example (adjust to your account’s supported R2 notification / event-subscription commands):

```bash
# Document the exact command used in your account runbook after validation.
# Prefer object create events for the documents bucket → processing queue.
```

The Worker also enqueues a metadata-only message after successful upload so local development and missing notification configs still process documents. Queue idempotency prevents duplicate side effects.

### Custom Domains

Staging:

```bash
# Deploy staging Worker first, then attach custom domain if not using routes in wrangler.jsonc
npx wrangler deploy --env staging
```

`wrangler.jsonc` already declares:

- staging: `docops-stg.orangecloud.vn`
- production: `docops.orangecloud.vn`

Do not overwrite DNS if an incompatible record already exists — resolve manually in Cloudflare DNS.

### Cloudflare Access

1. Create Access applications for both hostnames.
2. Set secrets:

```bash
npx wrangler secret put CF_ACCESS_AUD --env staging
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env staging
npx wrangler secret put CF_ACCESS_AUD --env production
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env production
```

3. Provision application users (or first-login viewer mapping) in D1.

### Workers AI

The `AI` binding is declared for future Phase 2 extraction. Phase 1 does not call it for field extraction.

## Migrations

```bash
npm run db:migrate:local
npm run db:migrate:staging
# Production only when intentionally releasing:
npm run db:migrate:production
```

## Validation commands

```bash
npm run cf-typegen
npm run typecheck
npm run lint
npm test
npm run build
```

## Deployment

Staging:

```bash
npm run deploy:staging
```

Production (manual only — do not automate in Phase 1):

```bash
npm run deploy:production
```

`workers_dev` is disabled for staging and production environments.
