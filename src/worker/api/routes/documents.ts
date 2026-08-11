import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rate-limit";
import { fail, ok } from "../response";
import { documentsQuerySchema, createDocumentSchema, jsonUploadSchema } from "../schemas/common";
import { sanitizeFilename } from "../../storage/filename";
import { uploadDocument } from "../../services/upload";
import {
  getDocument,
  enrichDocumentsForList,
  getVersion,
  listDocuments,
  listExtractedFields,
  listProcessingRuns,
  listVersions,
} from "../../db/repositories/documents";
import { listRuleResultsForDocument } from "../../db/repositories/cases";
import { listReviewDecisionsForDocument } from "../../db/repositories/reviews";
import { appendAuditEvent, listAuditEvents } from "../../domain/audit/service";
import { canUpload } from "../../auth/principal";
import { createId, nowIso } from "../../utils/id";
import { buildIdempotencyKey } from "../../domain/documents/status-machine";
import { transitionDocumentStatus } from "../../domain/documents/service";
import type { DocumentStatus } from "@shared/domain";
import type { ProcessingQueueMessage } from "@shared/queue";
import { previewKindFromMimeAndName } from "@shared/preview";

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

  const items = await enrichDocumentsForList(c.env.DOCOPS_DB, result.items);

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
    const maxBytes = Number(c.env.MAX_UPLOAD_BYTES || "10485760");
    const contentLength = Number(c.req.header("content-length") || "0");
    if (
      Number.isFinite(maxBytes) &&
      contentLength > 0 &&
      contentLength > maxBytes + 65536
    ) {
      return fail(
        c,
        413,
        "FILE_TOO_LARGE",
        `File exceeds maximum size of ${maxBytes} bytes`,
      );
    }

    let file: File;
    let documentType:
      | "vendor_contract"
      | "purchase_order"
      | "invoice_xml"
      | "invoice_pdf"
      | "unknown"
      | undefined;
    let caseId: string | undefined;
    let displayName: string | undefined;

    if (contentType.includes("application/json")) {
      // Preferred path: JSON + base64. Multipart is often blocked by edge WAF
      // as HTML 403 even when the user has a valid Access session.
      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return fail(c, 400, "VALIDATION_ERROR", "Invalid JSON body");
      }
      const parsed = jsonUploadSchema.safeParse(raw);
      if (!parsed.success) {
        return fail(
          c,
          400,
          "VALIDATION_ERROR",
          "Invalid upload payload",
          parsed.error.flatten(),
        );
      }
      const body = parsed.data;
      let bytes: Uint8Array;
      try {
        const binary = atob(body.contentBase64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
      } catch {
        return fail(c, 400, "VALIDATION_ERROR", "Invalid contentBase64");
      }
      if (bytes.byteLength === 0) {
        return fail(c, 400, "VALIDATION_ERROR", "Empty file content");
      }
      if (Number.isFinite(maxBytes) && bytes.byteLength > maxBytes) {
        return fail(
          c,
          413,
          "FILE_TOO_LARGE",
          `File exceeds maximum size of ${maxBytes} bytes`,
        );
      }
      const safeName = sanitizeFilename(body.filename);
      const mime =
        body.mimeType?.trim() ||
        (safeName.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : safeName.toLowerCase().endsWith(".xml")
            ? "application/xml"
            : "application/octet-stream");
      file = new File([bytes], safeName, { type: mime });
      documentType = body.documentType;
      caseId = body.caseId;
      displayName = body.displayName;
    } else if (contentType.includes("multipart/form-data")) {
      const form = await c.req.parseBody({ all: true });
      const formFile = form.file;
      if (!(formFile instanceof File)) {
        return fail(c, 400, "VALIDATION_ERROR", "file is required");
      }
      file = formFile;
      const documentTypeRaw =
        typeof form.documentType === "string" ? form.documentType : undefined;
      caseId = typeof form.caseId === "string" ? form.caseId : undefined;
      displayName =
        typeof form.displayName === "string" ? form.displayName : undefined;
      if (documentTypeRaw) {
        const parsedType = createDocumentSchema.shape.documentType.safeParse(
          documentTypeRaw,
        );
        if (!parsedType.success) {
          return fail(c, 400, "VALIDATION_ERROR", "Invalid documentType");
        }
        documentType = parsedType.data;
      }
    } else {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Expected application/json or multipart/form-data",
      );
    }

    try {
      const result = await uploadDocument(
        c.env,
        principal,
        c.get("requestId"),
        {
          file,
          documentType,
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
      const status =
        code === "FILE_TOO_LARGE"
          ? 413
          : code === "CASE_NOT_FOUND"
            ? 404
            : code === "UNSUPPORTED_FILE_TYPE" ||
                code === "MIME_MISMATCH" ||
                code === "VALIDATION_ERROR"
              ? 400
              : 500;
      return fail(c, status, code, message);
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

  const [runs, fields, rules, decisions, audit] = await Promise.all([
    currentVersion
      ? listProcessingRuns(c.env.DOCOPS_DB, currentVersion.id)
      : Promise.resolve([]),
    currentVersion
      ? listExtractedFields(c.env.DOCOPS_DB, currentVersion.id)
      : Promise.resolve([]),
    listRuleResultsForDocument(c.env.DOCOPS_DB, documentId),
    listReviewDecisionsForDocument(c.env.DOCOPS_DB, documentId),
    listAuditEvents(c.env.DOCOPS_DB, principal.organizationId, {
      entityId: documentId,
      entityType: "document",
      limit: 50,
      offset: 0,
    }),
  ]);

  const previewKind = currentVersion
    ? previewKindFromMimeAndName(
        currentVersion.mime_type,
        currentVersion.original_filename,
      )
    : "unsupported";

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
      available: previewKind !== "unsupported",
      kind: previewKind,
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

    const inline = c.req.query("disposition") === "inline";
    const safeName = version.original_filename.replace(/"/g, "");
    const headers = new Headers();
    headers.set(
      "content-type",
      version.mime_type || "application/octet-stream",
    );
    headers.set(
      "content-disposition",
      inline
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`,
    );
    headers.set("cache-control", "private, no-store");
    headers.set("x-request-id", c.get("requestId"));
    return new Response(object.body, { status: 200, headers });
  },
);

documentRoutes.post(
  "/documents/:documentId/preview",
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

    const kind = previewKindFromMimeAndName(
      version.mime_type,
      version.original_filename,
    );
    if (kind === "unsupported") {
      return fail(c, 400, "PREVIEW_UNSUPPORTED", "Preview not available for this file type");
    }

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "document.previewed",
      entityType: "document",
      entityId: documentId,
      requestId: c.get("requestId"),
      metadata: {
        kind,
        versionId: version.id,
        mimeType: version.mime_type,
      },
    });

    return ok(c, { recorded: true, kind });
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
