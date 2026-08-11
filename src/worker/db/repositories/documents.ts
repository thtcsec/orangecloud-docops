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

export async function createExtractedField(
  db: Db,
  row: ExtractedFieldRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO extracted_fields (
        id, processing_run_id, document_version_id, field_name, raw_value,
        normalized_value, value_type, confidence, source_kind, source_reference,
        provider, model_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.processing_run_id,
      row.document_version_id,
      row.field_name,
      row.raw_value,
      row.normalized_value,
      row.value_type,
      row.confidence,
      row.source_kind,
      row.source_reference,
      row.provider,
      row.model_version,
      row.created_at,
    )
    .run();
}

export async function clearExtractedFieldsForRun(
  db: Db,
  processingRunId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM extracted_fields WHERE processing_run_id = ?`)
    .bind(processingRunId)
    .run();
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

/** Batch enrich a document list (avoids 2N queries per page). */
export async function enrichDocumentsForList(
  db: Db,
  docs: DocumentRow[],
): Promise<
  Array<
    DocumentRow & {
      fileSize: number | null;
      latestProcessing: {
        id: string;
        status: string;
        errorCode: string | null;
        provider: string;
      } | null;
    }
  >
> {
  const versionIds = docs
    .map((d) => d.current_version_id)
    .filter((id): id is string => Boolean(id));

  if (versionIds.length === 0) {
    return docs.map((doc) => ({
      ...doc,
      fileSize: null,
      latestProcessing: null,
    }));
  }

  const placeholders = versionIds.map(() => "?").join(",");
  const versions = await all<{ id: string; file_size: number }>(
    db
      .prepare(
        `SELECT id, file_size FROM document_versions WHERE id IN (${placeholders})`,
      )
      .bind(...versionIds),
  );
  const runs = await all<ProcessingRunRow>(
    db
      .prepare(
        `SELECT * FROM processing_runs
         WHERE document_version_id IN (${placeholders})
         ORDER BY created_at DESC`,
      )
      .bind(...versionIds),
  );

  const sizeById = new Map(versions.map((v) => [v.id, v.file_size]));
  const latestByVersion = new Map<string, ProcessingRunRow>();
  for (const run of runs) {
    if (!latestByVersion.has(run.document_version_id)) {
      latestByVersion.set(run.document_version_id, run);
    }
  }

  return docs.map((doc) => {
    const versionId = doc.current_version_id;
    const latest = versionId ? latestByVersion.get(versionId) : undefined;
    return {
      ...doc,
      fileSize: versionId ? (sizeById.get(versionId) ?? null) : null,
      latestProcessing: latest
        ? {
            id: latest.id,
            status: latest.status,
            errorCode: latest.error_code,
            provider: latest.provider,
          }
        : null,
    };
  });
}

export async function getExtractedFieldById(
  db: Db,
  fieldId: string,
): Promise<ExtractedFieldRow | null> {
  return first<ExtractedFieldRow>(
    db.prepare(`SELECT * FROM extracted_fields WHERE id = ? LIMIT 1`).bind(fieldId),
  );
}

export async function updateExtractedField(
  db: Db,
  fieldId: string,
  patch: {
    normalized_value?: string | null;
    raw_value?: string | null;
    confidence?: number | null;
    source_kind?: string | null;
  },
): Promise<ExtractedFieldRow | null> {
  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = ?`);
    binds.push(value);
  }
  if (fields.length === 0) {
    return getExtractedFieldById(db, fieldId);
  }
  binds.push(fieldId);
  await db
    .prepare(`UPDATE extracted_fields SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
  return getExtractedFieldById(db, fieldId);
}

export type ExportDocumentItem = {
  id: string;
  display_name: string;
  document_type: string;
  status: string;
  case_reference: string | null;
  vendor_name: string | null;
  vendor_tax_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal: string | null;
  tax_amount: string | null;
  total_amount: string | null;
  created_at: string;
  reviewer_email: string | null;
  decision: string | null;
  decided_at: string | null;
};

export async function getDocumentsForExport(
  db: Db,
  organizationId: string,
  filter?: {
    status?: string;
    documentType?: string;
    from?: string;
    to?: string;
  },
): Promise<ExportDocumentItem[]> {
  let query = `
    SELECT 
      d.id,
      d.display_name,
      d.document_type,
      d.status,
      d.created_at,
      c.reference as case_reference,
      c.vendor_name,
      c.vendor_tax_id,
      d.current_version_id
    FROM documents d
    LEFT JOIN contract_to_pay_cases c ON c.id = d.case_id
    WHERE d.organization_id = ?
  `;
  const binds: unknown[] = [organizationId];

  if (filter?.status) {
    query += ` AND d.status = ?`;
    binds.push(filter.status);
  }
  if (filter?.documentType) {
    query += ` AND d.document_type = ?`;
    binds.push(filter.documentType);
  }
  if (filter?.from) {
    query += ` AND d.created_at >= ?`;
    binds.push(filter.from);
  }
  if (filter?.to) {
    query += ` AND d.created_at <= ?`;
    binds.push(filter.to);
  }

  query += ` ORDER BY d.created_at DESC LIMIT 500`;

  const rows = await all<
    DocumentRow & {
      case_reference: string | null;
      vendor_name: string | null;
      vendor_tax_id: string | null;
    }
  >(db.prepare(query).bind(...binds));

  const items: ExportDocumentItem[] = [];

  for (const doc of rows) {
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;
    let subtotal: string | null = null;
    let taxAmount: string | null = null;
    let totalAmount: string | null = null;
    let reviewerEmail: string | null = null;
    let decision: string | null = null;
    let decidedAt: string | null = null;

    if (doc.current_version_id) {
      const fields = await listExtractedFields(db, doc.current_version_id);
      for (const f of fields) {
        if (f.field_name === "invoice_number") invoiceNumber = f.normalized_value;
        if (f.field_name === "invoice_date") invoiceDate = f.normalized_value;
        if (f.field_name === "subtotal") subtotal = f.normalized_value;
        if (f.field_name === "tax_amount") taxAmount = f.normalized_value;
        if (f.field_name === "total_amount") totalAmount = f.normalized_value;
        if (!doc.vendor_tax_id && f.field_name === "vendor_tax_id") {
          doc.vendor_tax_id = f.normalized_value;
        }
        if (!doc.vendor_name && f.field_name === "vendor_name") {
          doc.vendor_name = f.normalized_value;
        }
      }
    }

    const reviewTask = await first<{ id: string }>(
      db.prepare(`SELECT id FROM review_tasks WHERE document_id = ? ORDER BY created_at DESC LIMIT 1`).bind(doc.id),
    );
    if (reviewTask) {
      const dec = await first<{ decision: string; created_at: string; email: string }>(
        db.prepare(
          `SELECT rd.decision, rd.created_at, u.email 
           FROM review_decisions rd 
           JOIN users u ON u.id = rd.reviewer_id 
           WHERE rd.review_task_id = ? 
           ORDER BY rd.created_at DESC LIMIT 1`,
        ).bind(reviewTask.id),
      );
      if (dec) {
        decision = dec.decision;
        decidedAt = dec.created_at;
        reviewerEmail = dec.email;
      }
    }

    items.push({
      id: doc.id,
      display_name: doc.display_name,
      document_type: doc.document_type,
      status: doc.status,
      case_reference: doc.case_reference,
      vendor_name: doc.vendor_name,
      vendor_tax_id: doc.vendor_tax_id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      created_at: doc.created_at,
      reviewer_email: reviewerEmail,
      decision,
      decided_at: decidedAt,
    });
  }

  return items;
}

