# OrangeCloud DocOps — Architecture

![Architecture](./images/architecture.png)

## Purpose

Cloudflare-based Contract-to-Pay document workflow accelerator connecting Legal, Procurement, and Accounting documents. Phase 1 establishes ingestion, storage, async processing foundations, human review, audit, and an internal operations UI. Phase 1.5 adds deterministic Vietnamese invoice XML parsing and the first Contract-to-Pay rules. It is not an ERP, tax platform, CLM, or Document AI SaaS.

## Runtime topology

```text
Browser (React SPA)
    │ same origin
    ▼
Cloudflare Worker (Hono /api + SPA assets)
    ├── D1  (metadata, cases, reviews, audit, extracted fields, rule results)
    ├── R2  (original document binaries)
    ├── Queue (metadata-only processing messages)
    └── Workflow (extract → validate rules → waitForEvent review)
```

## Processing pipeline

```text
Upload → R2 put → Queue → Workflow
  → classify (heuristic)
  → parse VN invoice XML when applicable
  → persist extracted_fields
  → EVALUATE deterministic rules
  → NEEDS_REVIEW (always human-gated)
  → waitForEvent(review-decision)
  → APPROVED / REJECTED / FAILED
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

## Phase non-goals

- Fabricated AI extraction values
- Paid external Document AI providers (adapters later)
- Vectorize / semantic search
- Durable Objects as a database
- Public R2 access
- Password authentication
- Silent auto-approval without human review
