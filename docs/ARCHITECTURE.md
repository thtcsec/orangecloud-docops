# OrangeCloud DocOps — Phase 1 Architecture

## Purpose

Cloudflare-based Contract-to-Pay document workflow accelerator connecting Legal, Procurement, and Accounting documents. Phase 1 establishes ingestion, storage, async processing foundations, human review, audit, and an internal operations UI. It is not an ERP, tax platform, CLM, or Document AI SaaS.

## Runtime topology

```text
Browser (React SPA)
    │ same origin
    ▼
Cloudflare Worker (Hono /api + SPA assets)
    ├── D1  (metadata, cases, reviews, audit)
    ├── R2  (original document binaries)
    ├── Queue (metadata-only processing messages)
    └── Workflow (durable multi-step processing + waitForEvent review)
```

## Document object keys

```text
{environment}/{organizationId}/{documentId}/{versionId}/original/{sanitizedFilename}
```

## Idempotency

Processing runs use:

```text
documentVersionId + operation + processingVersion
```

Duplicate queue deliveries reuse an existing non-failed run / workflow instance.

## AuthZ

| Role | Capabilities |
|------|----------------|
| admin | All pages, upload, review, audit, future integrations |
| reviewer | Documents/cases, review decisions |
| viewer | Read-only documents/cases/status |

Production identity: Cloudflare Access JWT validation. Local identity: explicit `LOCAL_DEV_AUTH_*` only.

## Phase 1 non-goals

- Real AI extraction
- Paid external Document AI providers
- Vectorize / semantic search
- Durable Objects as a database
- Public R2 access
- Password authentication
