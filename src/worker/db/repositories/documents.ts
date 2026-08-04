import type { DocumentStatus, DocumentType } from "@shared/domain";
import type {
  DocumentRow,
  DocumentVersionRow,
  ExtractedFieldRow,
  ProcessingRunRow,
} from "../schema/types";
import { all, first, type Db } from "./base";

export type DocumentListFilters = {
  organizationId: string;
  documentType?: DocumentType;
  status?: DocumentStatus;
  needsReview?: boolean;
  uploadedFrom?: string;
  uploadedTo?: string;
  search?: string;
  limit: number;
  offset: number;
};

export async function createDocument(
  db: Db,
  row: DocumentRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO documents (
        id, organization_id, display_name, document_type, source, status,
        current_version_id, case_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.organization_id,
      row.display_name,
      row.document_type,
      row.source,
      row.status,
      row.current_version_id,
      row.case_id,
      row.created_by,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function createDocumentVersion(
  db: Db,
  row: DocumentVersionRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO document_versions (
        id, document_id, version_number, r2_object_key, original_filename,
        mime_type, file_size, sha256, etag, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.document_id,
      row.version_number,
      row.r2_object_key,
      row.original_filename,
      row.mime_type,
      row.file_size,
      row.sha256,
      row.etag,
      row.created_by,
      row.created_at,
    )
    .run();
}

export async function updateDocument(
  db: Db,
  id: string,
  patch: Partial<
    Pick<
      DocumentRow,
      | "status"
      | "current_version_id"
      | "case_id"
      | "display_name"
      | "document_type"
      | "updated_at"
    >
  >,
): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = ?`);
    binds.push(value);
  }
  if (fields.length === 0) return;
  binds.push(id);
  await db
    .prepare(`UPDATE documents SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
}

export async function getDocument(
  db: Db,
  organizationId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  return first<DocumentRow>(
    db
      .prepare(
        `SELECT * FROM documents WHERE id = ? AND organization_id = ? LIMIT 1`,
      )
      .bind(documentId, organizationId),
  );
}

export async function getDocumentById(
  db: Db,
  documentId: string,
): Promise<DocumentRow | null> {
  return first<DocumentRow>(
    db.prepare(`SELECT * FROM documents WHERE id = ? LIMIT 1`).bind(documentId),
  );
}

export async function getVersion(
  db: Db,
  versionId: string,
): Promise<DocumentVersionRow | null> {
  return first<DocumentVersionRow>(
    db
      .prepare(`SELECT * FROM document_versions WHERE id = ? LIMIT 1`)
      .bind(versionId),
  );
}

export async function getVersionByKey(
  db: Db,
  r2ObjectKey: string,
): Promise<DocumentVersionRow | null> {
  return first<DocumentVersionRow>(
    db
      .prepare(
        `SELECT * FROM document_versions WHERE r2_object_key = ? LIMIT 1`,
      )
      .bind(r2ObjectKey),
  );
}

export async function listVersions(
  db: Db,
  documentId: string,
): Promise<DocumentVersionRow[]> {
  return all<DocumentVersionRow>(
    db
      .prepare(
        `SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC`,
      )
      .bind(documentId),
  );
}

export async function findDuplicateBySha(
  db: Db,
  organizationId: string,
  sha256: string,
): Promise<(DocumentVersionRow & { document_display_name: string }) | null> {
  return first<DocumentVersionRow & { document_display_name: string }>(
    db
      .prepare(
        `SELECT dv.*, d.display_name as document_display_name
         FROM document_versions dv
         INNER JOIN documents d ON d.id = dv.document_id
         WHERE d.organization_id = ? AND dv.sha256 = ?
         ORDER BY dv.created_at ASC
         LIMIT 1`,
      )
      .bind(organizationId, sha256),
  );
}

export async function nextVersionNumber(
  db: Db,
  documentId: string,
): Promise<number> {
  const row = await first<{ m: number | null }>(
    db
      .prepare(
        `SELECT MAX(version_number) as m FROM document_versions WHERE document_id = ?`,
      )
      .bind(documentId),
  );
  return (row?.m ?? 0) + 1;
}

export async function listDocuments(
  db: Db,
  filters: DocumentListFilters,
): Promise<{ items: DocumentRow[]; total: number }> {
  const where = ["organization_id = ?"];
  const binds: unknown[] = [filters.organizationId];

  if (filters.documentType) {
    where.push("document_type = ?");
    binds.push(filters.documentType);
  }
  if (filters.status) {
    where.push("status = ?");
    binds.push(filters.status);
  }
  if (filters.needsReview) {
    where.push("status = 'NEEDS_REVIEW'");
  }
  if (filters.uploadedFrom) {
    where.push("created_at >= ?");
    binds.push(filters.uploadedFrom);
  }
  if (filters.uploadedTo) {
    where.push("created_at <= ?");
    binds.push(filters.uploadedTo);
  }
  if (filters.search) {
    where.push("(display_name LIKE ? OR id LIKE ?)");
    const q = `%${filters.search}%`;
    binds.push(q, q);
  }

  const whereSql = where.join(" AND ");
  const totalRow = await first<{ c: number }>(
    db
      .prepare(`SELECT COUNT(*) as c FROM documents WHERE ${whereSql}`)
      .bind(...binds),
  );
  const items = await all<DocumentRow>(
    db
      .prepare(
        `SELECT * FROM documents WHERE ${whereSql}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, filters.limit, filters.offset),
  );
  return { items, total: totalRow?.c ?? 0 };
}

export async function getDashboardStats(db: Db, organizationId: string) {
  const row = await first<{
    total_documents: number;
    processing: number;
    needs_review: number;
    failed: number;
    open_cases: number;
  }>(
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM documents WHERE organization_id = ?) as total_documents,
          (SELECT COUNT(*) FROM documents WHERE organization_id = ? AND status IN ('QUEUED','PROCESSING','EXTRACTED','VALIDATING','EXPORTING')) as processing,
          (SELECT COUNT(*) FROM documents WHERE organization_id = ? AND status = 'NEEDS_REVIEW') as needs_review,
          (SELECT COUNT(*) FROM documents WHERE organization_id = ? AND status = 'FAILED') as failed,
          (SELECT COUNT(*) FROM contract_to_pay_cases WHERE organization_id = ? AND status IN ('open','in_review')) as open_cases`,
      )
      .bind(
        organizationId,
        organizationId,
        organizationId,
        organizationId,
        organizationId,
      ),
  );
  return (
    row ?? {
      total_documents: 0,
      processing: 0,
      needs_review: 0,
      failed: 0,
      open_cases: 0,
    }
  );
}

export async function createProcessingRun(
  db: Db,
  row: ProcessingRunRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO processing_runs (
        id, document_version_id, workflow_instance_id, provider, provider_model,
        status, attempt, idempotency_key, started_at, completed_at,
        error_code, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.document_version_id,
      row.workflow_instance_id,
      row.provider,
      row.provider_model,
      row.status,
      row.attempt,
      row.idempotency_key,
      row.started_at,
      row.completed_at,
      row.error_code,
      row.error_message,
      row.created_at,
    )
    .run();
}

export async function getProcessingRunByIdempotencyKey(
  db: Db,
  key: string,
): Promise<ProcessingRunRow | null> {
  return first<ProcessingRunRow>(
    db
      .prepare(
        `SELECT * FROM processing_runs WHERE idempotency_key = ? LIMIT 1`,
      )
      .bind(key),
  );
}

export async function updateProcessingRun(
  db: Db,
  id: string,
  patch: Partial<ProcessingRunRow>,
): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id") continue;
    fields.push(`${key} = ?`);
    binds.push(value);
  }
  if (fields.length === 0) return;
  binds.push(id);
  await db
    .prepare(`UPDATE processing_runs SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
}

export async function listProcessingRuns(
  db: Db,
  documentVersionId: string,
): Promise<ProcessingRunRow[]> {
  return all<ProcessingRunRow>(
    db
      .prepare(
        `SELECT * FROM processing_runs WHERE document_version_id = ? ORDER BY created_at DESC`,
      )
      .bind(documentVersionId),
  );
}

export async function listExtractedFields(
  db: Db,
  documentVersionId: string,
): Promise<ExtractedFieldRow[]> {
  return all<ExtractedFieldRow>(
    db
      .prepare(
        `SELECT * FROM extracted_fields WHERE document_version_id = ? ORDER BY created_at DESC`,
      )
      .bind(documentVersionId),
  );
}

export async function getLatestProcessingResult(
  db: Db,
  documentVersionId: string | null,
): Promise<ProcessingRunRow | null> {
  if (!documentVersionId) return null;
  return first<ProcessingRunRow>(
    db
      .prepare(
        `SELECT * FROM processing_runs WHERE document_version_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(documentVersionId),
  );
}
