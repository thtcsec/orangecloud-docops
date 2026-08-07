import type { RelationshipType } from "@shared/domain";
import type {
  CaseDocumentRow,
  CaseRow,
  DocumentRow,
  RuleResultRow,
} from "../schema/types";
import { all, first, type Db } from "./base";

export async function createCase(db: Db, row: CaseRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO contract_to_pay_cases (
        id, organization_id, reference, vendor_name, vendor_tax_id,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.organization_id,
      row.reference,
      row.vendor_name,
      row.vendor_tax_id,
      row.status,
      row.created_by,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function getCase(
  db: Db,
  organizationId: string,
  caseId: string,
): Promise<CaseRow | null> {
  return first<CaseRow>(
    db
      .prepare(
        `SELECT * FROM contract_to_pay_cases WHERE id = ? AND organization_id = ? LIMIT 1`,
      )
      .bind(caseId, organizationId),
  );
}

export async function listCases(
  db: Db,
  organizationId: string,
  limit: number,
  offset: number,
): Promise<{ items: CaseRow[]; total: number }> {
  const totalRow = await first<{ c: number }>(
    db
      .prepare(
        `SELECT COUNT(*) as c FROM contract_to_pay_cases WHERE organization_id = ?`,
      )
      .bind(organizationId),
  );
  const items = await all<CaseRow>(
    db
      .prepare(
        `SELECT * FROM contract_to_pay_cases WHERE organization_id = ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(organizationId, limit, offset),
  );
  return { items, total: totalRow?.c ?? 0 };
}

export async function linkCaseDocument(
  db: Db,
  row: CaseDocumentRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO case_documents (case_id, document_id, relationship_type, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(case_id, document_id) DO UPDATE SET relationship_type = excluded.relationship_type`,
    )
    .bind(
      row.case_id,
      row.document_id,
      row.relationship_type,
      row.created_at,
    )
    .run();
}

export async function listCaseDocuments(
  db: Db,
  caseId: string,
): Promise<(CaseDocumentRow & { document: DocumentRow })[]> {
  const rows = await all<CaseDocumentRow & DocumentRow>(
    db
      .prepare(
        `SELECT cd.case_id, cd.document_id, cd.relationship_type, cd.created_at as link_created_at,
                d.id, d.organization_id, d.display_name, d.document_type, d.source, d.status,
                d.current_version_id, d.case_id as doc_case_id, d.created_by, d.created_at, d.updated_at
         FROM case_documents cd
         INNER JOIN documents d ON d.id = cd.document_id
         WHERE cd.case_id = ?
         ORDER BY cd.created_at ASC`,
      )
      .bind(caseId),
  );

  return rows.map((r) => ({
    case_id: r.case_id,
    document_id: r.document_id,
    relationship_type: r.relationship_type as RelationshipType,
    created_at: (r as unknown as { link_created_at: string }).link_created_at,
    document: {
      id: r.id,
      organization_id: r.organization_id,
      display_name: r.display_name,
      document_type: r.document_type,
      source: r.source,
      status: r.status,
      current_version_id: r.current_version_id,
      case_id: (r as unknown as { doc_case_id: string | null }).doc_case_id,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    },
  }));
}

export async function listRuleResultsForCase(
  db: Db,
  caseId: string,
): Promise<RuleResultRow[]> {
  return all<RuleResultRow>(
    db
      .prepare(
        `SELECT * FROM rule_results WHERE case_id = ? ORDER BY created_at DESC`,
      )
      .bind(caseId),
  );
}

export async function listRuleResultsForDocument(
  db: Db,
  documentId: string,
): Promise<RuleResultRow[]> {
  return all<RuleResultRow>(
    db
      .prepare(
        `SELECT * FROM rule_results WHERE document_id = ? ORDER BY created_at DESC`,
      )
      .bind(documentId),
  );
}

export async function clearRuleResultsForDocument(
  db: Db,
  documentId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM rule_results WHERE document_id = ?`)
    .bind(documentId)
    .run();
}

export async function createRuleResult(
  db: Db,
  row: RuleResultRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO rule_results (
        id, case_id, document_id, rule_key, rule_version, status, severity,
        expected_value, actual_value, explanation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.case_id,
      row.document_id,
      row.rule_key,
      row.rule_version,
      row.status,
      row.severity,
      row.expected_value,
      row.actual_value,
      row.explanation,
      row.created_at,
    )
    .run();
}

export async function countExceptions(db: Db, caseId: string): Promise<number> {
  const row = await first<{ c: number }>(
    db
      .prepare(
        `SELECT COUNT(*) as c FROM rule_results
         WHERE case_id = ? AND status IN ('fail','warning')`,
      )
      .bind(caseId),
  );
  return row?.c ?? 0;
}
