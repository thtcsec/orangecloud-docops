import type { Db } from "../db/repositories/base";
import { getDocument } from "../db/repositories/documents";
import { appendAuditEvent } from "../domain/audit/service";
import { transitionDocumentStatus } from "../domain/documents/service";
import {
  postErpWebhook,
  resolveErpWebhookUrl,
} from "./erp-webhook";
import { nowIso } from "../utils/id";

export type ExportOutcome =
  | { exportStatus: "skipped" }
  | { exportStatus: "exported" }
  | { exportStatus: "failed"; exportError: string };

export async function exportApprovedDocument(input: {
  env: Env;
  db: Db;
  organizationId: string;
  documentId: string;
  actorId: string;
  actorEmail?: string;
  decision: string;
  comment?: string | null;
  requestId: string;
  reviewTaskId?: string;
}): Promise<ExportOutcome> {
  const webhookUrl = await resolveErpWebhookUrl(
    input.env,
    input.organizationId,
  );
  if (!webhookUrl) {
    await appendAuditEvent(input.db, {
      organizationId: input.organizationId,
      actorType: "system",
      actorId: "export",
      action: "export.skipped",
      entityType: "document",
      entityId: input.documentId,
      requestId: input.requestId,
      metadata: { reason: "webhook_not_configured" },
    });
    return { exportStatus: "skipped" };
  }

  const doc = await getDocument(
    input.db,
    input.organizationId,
    input.documentId,
  );
  if (!doc) {
    return { exportStatus: "failed", exportError: "Document not found" };
  }

  const result = await postErpWebhook(webhookUrl, {
    event: "document.approved",
    organizationId: input.organizationId,
    documentId: doc.id,
    displayName: doc.display_name,
    documentType: doc.document_type,
    status: "APPROVED",
    decision: input.decision,
    caseId: doc.case_id,
    reviewerId: input.actorId,
    reviewerEmail: input.actorEmail,
    comment: input.comment ?? null,
    requestId: input.requestId,
    timestamp: nowIso(),
  });

  if (!result.ok) {
    await appendAuditEvent(input.db, {
      organizationId: input.organizationId,
      actorType: "system",
      actorId: "export",
      action: "export.failed",
      entityType: "document",
      entityId: input.documentId,
      requestId: input.requestId,
      metadata: {
        reviewTaskId: input.reviewTaskId,
        status: result.status,
        message: result.message,
      },
    });
    return { exportStatus: "failed", exportError: result.message };
  }

  await transitionDocumentStatus(input.db, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    to: "EXPORTED",
    actorType: "system",
    actorId: "export",
    requestId: input.requestId,
    metadata: {
      reviewTaskId: input.reviewTaskId,
      webhookStatus: result.status,
    },
  });

  await appendAuditEvent(input.db, {
    organizationId: input.organizationId,
    actorType: "system",
    actorId: "export",
    action: "export.completed",
    entityType: "document",
    entityId: input.documentId,
    requestId: input.requestId,
    metadata: {
      reviewTaskId: input.reviewTaskId,
      webhookStatus: result.status,
    },
  });

  return { exportStatus: "exported" };
}
