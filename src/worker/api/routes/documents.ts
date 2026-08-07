import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rate-limit";
import { fail, ok } from "../response";
import { documentsQuerySchema } from "../schemas/common";
import { uploadDocument } from "../../services/upload";
import {
  getDocument,
  getLatestProcessingResult,
  getVersion,
  listDocuments,
  listExtractedFields,
  listProcessingRuns,
  listVersions,
} from "../../db/repositories/documents";
import { listRuleResultsForDocument } from "../../db/repositories/cases";
import { listReviewDecisionsForDocument } from "../../db/repositories/reviews";
import { listAuditEvents } from "../../domain/audit/service";
import { canUpload } from "../../auth/principal";
import { createId, nowIso } from "../../utils/id";
import { buildIdempotencyKey } from "../../domain/documents/status-machine";
import { transitionDocumentStatus } from "../../domain/documents/service";
import type { DocumentStatus } from "@shared/domain";
import type { ProcessingQueueMessage } from "@shared/queue";

export const documentRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

documentRoutes.get("/documents", requireAuth, async (c) => {
  const principal = c.get("principal")!;
  const parsed = documentsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, 400, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten());
  }
  const q = parsed.data;
  const offset = (q.page - 1) * q.pageSize;
  const result = await listDocuments(c.env.DOCOPS_DB, {
    organizationId: principal.organizationId,
    documentType: q.documentType,
    status: q.status as DocumentStatus | undefined,
    needsReview: q.needsReview,
    uploadedFrom: q.uploadedFrom,
    uploadedTo: q.uploadedTo,
    search: q.search,
    limit: q.pageSize,
    offset,
  });

  const items = await Promise.all(
    result.items.map(async (doc) => {
      const latest = await getLatestProcessingResult(
        c.env.DOCOPS_DB,
        doc.current_version_id,
      );
      const version = doc.current_version_id
        ? await getVersion(c.env.DOCOPS_DB, doc.current_version_id)
        : null;
      return {
        ...doc,
        fileSize: version?.file_size ?? null,
        latestProcessing: latest
          ? {
              id: latest.id,
              status: latest.status,
              errorCode: latest.error_code,
              provider: latest.provider,
            }
          : null,
      };
    }),
  );

  return ok(c, {
    items,
    page: q.page,
    pageSize: q.pageSize,
    total: result.total,
  });
});

documentRoutes.post(
  "/documents",
  requireAuth,
  requireRoles("admin", "reviewer"),
  uploadRateLimit,
  async (c) => {
    const principal = c.get("principal")!;
    if (!canUpload(principal.role)) {
      return fail(c, 403, "FORBIDDEN", "Upload not permitted");
    }

    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return fail(c, 400, "VALIDATION_ERROR", "Expected multipart/form-data");
    }

    const form = await c.req.parseBody({ all: true });
    const file = form.file;
    if (!(file instanceof File)) {
      return fail(c, 400, "VALIDATION_ERROR", "file is required");
    }

    const documentType =
      typeof form.documentType === "string" ? form.documentType : undefined;
    const caseId = typeof form.caseId === "string" ? form.caseId : undefined;
    const displayName =
      typeof form.displayName === "string" ? form.displayName : undefined;

    try {
      const result = await uploadDocument(
        c.env,
        principal,
        c.get("requestId"),
        {
          file,
          documentType: documentType as
            | "vendor_contract"
            | "purchase_order"
            | "invoice_xml"
            | "invoice_pdf"
            | "unknown"
            | undefined,
          caseId,
          displayName,
        },
      );
      return ok(c, result, 201);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "UPLOAD_FAILED";
      const message = err instanceof Error ? err.message : "Upload failed";
      return fail(c, 400, code, message);
    }
  },
);

documentRoutes.get("/documents/:documentId", requireAuth, async (c) => {
  const principal = c.get("principal")!;
  const documentId = c.req.param("documentId");
  const doc = await getDocument(
    c.env.DOCOPS_DB,
    principal.organizationId,
    documentId,
  );
  if (!doc) return fail(c, 404, "NOT_FOUND", "Document not found");

  const versions = await listVersions(c.env.DOCOPS_DB, documentId);
  const currentVersion = doc.current_version_id
    ? await getVersion(c.env.DOCOPS_DB, doc.current_version_id)
    : null;
  const runs = currentVersion
    ? await listProcessingRuns(c.env.DOCOPS_DB, currentVersion.id)
    : [];
  const fields = currentVersion
    ? await listExtractedFields(c.env.DOCOPS_DB, currentVersion.id)
    : [];
  const rules = await listRuleResultsForDocument(c.env.DOCOPS_DB, documentId);
  const decisions = await listReviewDecisionsForDocument(
    c.env.DOCOPS_DB,
    documentId,
  );
  const audit = await listAuditEvents(
    c.env.DOCOPS_DB,
    principal.organizationId,
    { entityId: documentId, entityType: "document", limit: 50, offset: 0 },
  );

  return ok(c, {
    document: doc,
    versions,
    currentVersion,
    processingRuns: runs,
    extractedFields: fields,
    ruleResults: rules,
    reviewDecisions: decisions,
    auditEvents: audit.items,
    preview: {
      available: false,
      message:
        "Document preview is a safe placeholder in Phase 1. Use the protected download route.",
    },
  });
});

documentRoutes.get(
  "/documents/:documentId/download",
  requireAuth,
  async (c) => {
    const principal = c.get("principal")!;
    const documentId = c.req.param("documentId");
    const doc = await getDocument(
      c.env.DOCOPS_DB,
      principal.organizationId,
      documentId,
    );
    if (!doc) return fail(c, 404, "NOT_FOUND", "Document not found");
    if (!doc.current_version_id) {
      return fail(c, 404, "NOT_FOUND", "No document version available");
    }
    const version = await getVersion(c.env.DOCOPS_DB, doc.current_version_id);
    if (!version) return fail(c, 404, "NOT_FOUND", "Version not found");

    const object = await c.env.DOCUMENTS_BUCKET.get(version.r2_object_key);
    if (!object) return fail(c, 404, "NOT_FOUND", "Object not found in storage");

    const headers = new Headers();
    headers.set(
      "content-type",
      version.mime_type || "application/octet-stream",
    );
    headers.set(
      "content-disposition",
      `attachment; filename="${version.original_filename}"`,
    );
    headers.set("cache-control", "private, no-store");
    headers.set("x-request-id", c.get("requestId"));
    return new Response(object.body, { status: 200, headers });
  },
);

documentRoutes.post(
  "/documents/:documentId/reprocess",
  requireAuth,
  requireRoles("admin", "reviewer"),
  async (c) => {
    const principal = c.get("principal")!;
    const documentId = c.req.param("documentId");
    const doc = await getDocument(
      c.env.DOCOPS_DB,
      principal.organizationId,
      documentId,
    );
    if (!doc) return fail(c, 404, "NOT_FOUND", "Document not found");
    if (!doc.current_version_id) {
      return fail(c, 400, "NO_VERSION", "Document has no version to reprocess");
    }
    const version = await getVersion(c.env.DOCOPS_DB, doc.current_version_id);
    if (!version) return fail(c, 404, "NOT_FOUND", "Version not found");

    const requestId = c.get("requestId");
    const processingVersion = `${c.env.PROCESSING_VERSION || "v1"}-reprocess-${createId("rp").slice(-8)}`;
    const message: ProcessingQueueMessage = {
      kind: "document_reprocess",
      environment: c.env.ENVIRONMENT,
      organizationId: principal.organizationId,
      documentId,
      documentVersionId: version.id,
      r2ObjectKey: version.r2_object_key,
      etag: version.etag ?? undefined,
      sha256: version.sha256,
      mimeType: version.mime_type,
      fileSize: version.file_size,
      operation: "process_document",
      processingVersion,
      requestId,
      enqueuedAt: nowIso(),
    };

    await c.env.PROCESSING_QUEUE.send(message);
    await transitionDocumentStatus(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      documentId,
      to: "QUEUED",
      actorType: "user",
      actorId: principal.userId,
      requestId,
      metadata: {
        reprocess: true,
        idempotencyKey: buildIdempotencyKey(
          version.id,
          "process_document",
          processingVersion,
        ),
      },
    });

    return ok(c, { queued: true, processingVersion });
  },
);
