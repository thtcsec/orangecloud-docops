import type { DocumentStatus } from "@shared/domain";
import { appendAuditEvent } from "../audit/service";
import {
  getDocument,
  updateDocument,
} from "../../db/repositories/documents";
import type { Db } from "../../db/repositories/base";
import { assertTransition } from "./status-machine";
import { nowIso } from "../../utils/id";

export async function transitionDocumentStatus(
  db: Db,
  input: {
    organizationId: string;
    documentId: string;
    to: DocumentStatus;
    actorType: string;
    actorId?: string | null;
    requestId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ from: DocumentStatus; to: DocumentStatus; changed: boolean }> {
  const doc = await getDocument(db, input.organizationId, input.documentId);
  if (!doc) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const from = doc.status;
  assertTransition(from, input.to);

  if (from === input.to) {
    await appendAuditEvent(db, {
      organizationId: input.organizationId,
      actorType: input.actorType,
      actorId: input.actorId,
      action: "document.status.noop",
      entityType: "document",
      entityId: input.documentId,
      requestId: input.requestId,
      metadata: { from, to: input.to, ...input.metadata },
    });
    return { from, to: input.to, changed: false };
  }

  await updateDocument(db, input.documentId, {
    status: input.to,
    updated_at: nowIso(),
  });

  await appendAuditEvent(db, {
    organizationId: input.organizationId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: "document.status.changed",
    entityType: "document",
    entityId: input.documentId,
    requestId: input.requestId,
    metadata: { from, to: input.to, ...input.metadata },
  });

  return { from, to: input.to, changed: true };
}
