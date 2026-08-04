import type { DocumentType } from "@shared/domain";
import type { ProcessingQueueMessage } from "@shared/queue";
import type { AppPrincipal } from "../auth/principal";
import { createId, nowIso } from "../utils/id";
import { sanitizeFilename } from "../storage/filename";
import { validateMimeAndExtension } from "../storage/mime";
import { buildR2ObjectKey } from "../storage/object-key";
import { sha256HexFromStream } from "../storage/hash";
import {
  createDocument,
  createDocumentVersion,
  findDuplicateBySha,
  updateDocument,
} from "../db/repositories/documents";
import { appendAuditEvent } from "../domain/audit/service";
import { transitionDocumentStatus } from "../domain/documents/service";
import { logger } from "../utils/logger";

export type UploadResult = {
  documentId: string;
  versionId: string;
  r2ObjectKey: string;
  sha256: string;
  etag: string | null;
  duplicateOf?: {
    documentId: string;
    versionId: string;
    displayName: string;
  };
};

export async function uploadDocument(
  env: Env,
  principal: AppPrincipal,
  requestId: string,
  input: {
    file: File;
    documentType?: DocumentType;
    caseId?: string;
    displayName?: string;
  },
): Promise<UploadResult> {
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || "10485760");
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw Object.assign(new Error("Invalid MAX_UPLOAD_BYTES"), {
      code: "CONFIG_ERROR",
    });
  }
  if (input.file.size > maxBytes) {
    throw Object.assign(
      new Error(`File exceeds maximum size of ${maxBytes} bytes`),
      { code: "FILE_TOO_LARGE" },
    );
  }

  const validation = validateMimeAndExtension(input.file.name, input.file.type);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.message), {
      code: validation.code,
    });
  }

  const { hash, bytes, size } = await sha256HexFromStream(input.file.stream());
  const duplicate = await findDuplicateBySha(
    env.DOCOPS_DB,
    principal.organizationId,
    hash,
  );

  const documentId = createId("doc");
  const versionId = createId("ver");
  const now = nowIso();
  const filename = sanitizeFilename(input.file.name);
  const displayName = input.displayName?.trim() || filename;
  const documentType =
    input.documentType ??
    (validation.kind === "xml" ? "invoice_xml" : "unknown");

  const r2ObjectKey = buildR2ObjectKey({
    environment: env.ENVIRONMENT,
    organizationId: principal.organizationId,
    documentId,
    versionId,
    filename,
  });

  await createDocument(env.DOCOPS_DB, {
    id: documentId,
    organization_id: principal.organizationId,
    display_name: displayName,
    document_type: documentType,
    source: "upload",
    status: "UPLOADING",
    current_version_id: null,
    case_id: input.caseId ?? null,
    created_by: principal.userId,
    created_at: now,
    updated_at: now,
  });

  const putResult = await env.DOCUMENTS_BUCKET.put(r2ObjectKey, bytes, {
    httpMetadata: {
      contentType: input.file.type,
      contentDisposition: `attachment; filename="${filename}"`,
    },
    customMetadata: {
      organizationId: principal.organizationId,
      documentId,
      versionId,
      sha256: hash,
      originalFilename: filename,
      uploadedBy: principal.userId,
      requestId,
    },
  });

  const etag = putResult?.etag ?? null;

  await createDocumentVersion(env.DOCOPS_DB, {
    id: versionId,
    document_id: documentId,
    version_number: 1,
    r2_object_key: r2ObjectKey,
    original_filename: filename,
    mime_type: input.file.type,
    file_size: size,
    sha256: hash,
    etag,
    created_by: principal.userId,
    created_at: now,
  });

  await updateDocument(env.DOCOPS_DB, documentId, {
    current_version_id: versionId,
    updated_at: nowIso(),
  });

  await transitionDocumentStatus(env.DOCOPS_DB, {
    organizationId: principal.organizationId,
    documentId,
    to: "UPLOADED",
    actorType: "user",
    actorId: principal.userId,
    requestId,
    metadata: { versionId, r2ObjectKey, sha256: hash },
  });

  await appendAuditEvent(env.DOCOPS_DB, {
    organizationId: principal.organizationId,
    actorType: "user",
    actorId: principal.userId,
    action: "document.uploaded",
    entityType: "document",
    entityId: documentId,
    requestId,
    metadata: {
      versionId,
      filename,
      mimeType: input.file.type,
      fileSize: size,
      sha256: hash,
      etag,
      duplicate: Boolean(duplicate),
    },
  });

  // Enqueue processing using identifiers/metadata only (also covers local where R2 notifications may be absent).
  const queueMessage: ProcessingQueueMessage = {
    kind: "document_object_created",
    environment: env.ENVIRONMENT,
    organizationId: principal.organizationId,
    documentId,
    documentVersionId: versionId,
    r2ObjectKey,
    etag: etag ?? undefined,
    sha256: hash,
    mimeType: input.file.type,
    fileSize: size,
    operation: "process_document",
    processingVersion: env.PROCESSING_VERSION || "v1",
    requestId,
    enqueuedAt: nowIso(),
  };

  await env.PROCESSING_QUEUE.send(queueMessage);

  await transitionDocumentStatus(env.DOCOPS_DB, {
    organizationId: principal.organizationId,
    documentId,
    to: "QUEUED",
    actorType: "system",
    actorId: "queue",
    requestId,
  });

  logger.info("document_uploaded", {
    requestId,
    organizationId: principal.organizationId,
    userId: principal.userId,
    documentId,
    documentVersionId: versionId,
  });

  return {
    documentId,
    versionId,
    r2ObjectKey,
    sha256: hash,
    etag,
    duplicateOf: duplicate
      ? {
          documentId: duplicate.document_id,
          versionId: duplicate.id,
          displayName: duplicate.document_display_name,
        }
      : undefined,
  };
}
