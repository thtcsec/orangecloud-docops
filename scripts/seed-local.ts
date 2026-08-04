/**
 * Local-only seed. Never run against staging/production automatically.
 * Usage: npm run db:seed:local
 *
 * Applies synthetic metadata via wrangler d1 execute --local.
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const now = new Date().toISOString();
const orgId = "org_syntheticdemo001";
const adminId = "usr_syntheticadmin001";
const reviewerId = "usr_syntheticreviewer001";
const caseId = "case_syntheticc2p001";
const contractDocId = "doc_syntheticcontract01";
const poDocId = "doc_syntheticpo000001";
const invXmlDocId = "doc_syntheticinvxml001";
const invPdfDocId = "doc_syntheticinvpdf001";
const contractVerId = "ver_syntheticcontract01";
const poVerId = "ver_syntheticpo000001";
const invXmlVerId = "ver_syntheticinvxml001";
const invPdfVerId = "ver_syntheticinvpdf001";
const reviewTaskId = "rev_syntheticopen0001";

const sql = `
PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO organizations (id, name, slug, created_at, updated_at)
VALUES ('${orgId}', 'Acme Synthetic Trading Co.', 'acme-synthetic', '${now}', '${now}');

INSERT OR REPLACE INTO users (id, organization_id, email, display_name, role, created_at, updated_at)
VALUES
  ('${adminId}', '${orgId}', 'admin@docops.local', 'Local Admin', 'admin', '${now}', '${now}'),
  ('${reviewerId}', '${orgId}', 'reviewer@docops.local', 'Local Reviewer', 'reviewer', '${now}', '${now}');

INSERT OR REPLACE INTO contract_to_pay_cases (
  id, organization_id, reference, vendor_name, vendor_tax_id, status, created_by, created_at, updated_at
) VALUES (
  '${caseId}', '${orgId}', 'C2P-SYN-2026-001', 'Northern Widget Supplies LLC (SYNTHETIC)',
  'TAX-SYN-000111222', 'in_review', '${adminId}', '${now}', '${now}'
);

INSERT OR REPLACE INTO documents (
  id, organization_id, display_name, document_type, source, status,
  current_version_id, case_id, created_by, created_at, updated_at
) VALUES
  ('${contractDocId}', '${orgId}', 'SYNTHETIC Vendor Contract MSA.pdf', 'vendor_contract', 'seed', 'APPROVED', '${contractVerId}', '${caseId}', '${adminId}', '${now}', '${now}'),
  ('${poDocId}', '${orgId}', 'SYNTHETIC Purchase Order PO-1001.pdf', 'purchase_order', 'seed', 'APPROVED', '${poVerId}', '${caseId}', '${adminId}', '${now}', '${now}'),
  ('${invXmlDocId}', '${orgId}', 'SYNTHETIC Invoice INV-9001.xml', 'invoice_xml', 'seed', 'NEEDS_REVIEW', '${invXmlVerId}', '${caseId}', '${adminId}', '${now}', '${now}'),
  ('${invPdfDocId}', '${orgId}', 'SYNTHETIC Invoice INV-9001.pdf', 'invoice_pdf', 'seed', 'NEEDS_REVIEW', '${invPdfVerId}', '${caseId}', '${adminId}', '${now}', '${now}');

INSERT OR REPLACE INTO document_versions (
  id, document_id, version_number, r2_object_key, original_filename, mime_type,
  file_size, sha256, etag, created_by, created_at
) VALUES
  ('${contractVerId}', '${contractDocId}', 1, 'local/${orgId}/${contractDocId}/${contractVerId}/original/SYNTHETIC_Vendor_Contract_MSA.pdf', 'SYNTHETIC_Vendor_Contract_MSA.pdf', 'application/pdf', 1024, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'etag-contract', '${adminId}', '${now}'),
  ('${poVerId}', '${poDocId}', 1, 'local/${orgId}/${poDocId}/${poVerId}/original/SYNTHETIC_PO_1001.pdf', 'SYNTHETIC_PO_1001.pdf', 'application/pdf', 2048, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'etag-po', '${adminId}', '${now}'),
  ('${invXmlVerId}', '${invXmlDocId}', 1, 'local/${orgId}/${invXmlDocId}/${invXmlVerId}/original/SYNTHETIC_INV_9001.xml', 'SYNTHETIC_INV_9001.xml', 'application/xml', 512, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'etag-xml', '${adminId}', '${now}'),
  ('${invPdfVerId}', '${invPdfDocId}', 1, 'local/${orgId}/${invPdfDocId}/${invPdfVerId}/original/SYNTHETIC_INV_9001.pdf', 'SYNTHETIC_INV_9001.pdf', 'application/pdf', 3072, 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'etag-pdf', '${adminId}', '${now}');

INSERT OR REPLACE INTO case_documents (case_id, document_id, relationship_type, created_at) VALUES
  ('${caseId}', '${contractDocId}', 'contract', '${now}'),
  ('${caseId}', '${poDocId}', 'purchase_order', '${now}'),
  ('${caseId}', '${invXmlDocId}', 'invoice', '${now}'),
  ('${caseId}', '${invPdfDocId}', 'invoice', '${now}');

INSERT OR REPLACE INTO rule_results (
  id, case_id, document_id, rule_key, rule_version, status, severity,
  expected_value, actual_value, explanation, created_at
) VALUES
  ('rr_syntheticfail0001', '${caseId}', '${invXmlDocId}', 'invoice_within_po_value', 'v0', 'fail', 'high', '10000000', '12500000', 'SYNTHETIC: invoice total exceeds PO value (fixture exception).', '${now}'),
  ('rr_syntheticwarn0001', '${caseId}', '${invPdfDocId}', 'supplier_identity_match', 'v0', 'warning', 'medium', 'Northern Widget Supplies LLC (SYNTHETIC)', 'Northern Widget Supply', 'SYNTHETIC: vendor name fuzzy mismatch (fixture exception).', '${now}');

INSERT OR REPLACE INTO review_tasks (
  id, organization_id, document_id, case_id, status, reason, assigned_to, created_at, updated_at, resolved_at
) VALUES (
  '${reviewTaskId}', '${orgId}', '${invXmlDocId}', '${caseId}', 'open',
  'SYNTHETIC: open review for invoice/PO amount exception.', NULL, '${now}', '${now}', NULL
);

INSERT INTO audit_events (
  id, organization_id, actor_type, actor_id, action, entity_type, entity_id, request_id, metadata_json, created_at
) VALUES
  ('aud_syntheticseed0001', '${orgId}', 'system', 'seed', 'seed.applied', 'organization', '${orgId}', 'req_seed_local', '{"synthetic":true}', '${now}');
`;

const tmp = join(process.cwd(), ".seed-local.tmp.sql");
writeFileSync(tmp, sql, "utf8");

try {
  console.log("Seeding local D1 with synthetic fixtures…");
  execSync(
    `npx wrangler d1 execute DOCOPS_DB --local --file="${tmp}"`,
    { stdio: "inherit" },
  );
  console.log("Seed complete. Synthetic case C2P-SYN-2026-001 is available.");
} finally {
  try {
    unlinkSync(tmp);
  } catch {
    // ignore
  }
}
