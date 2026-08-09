/**
 * Local-only seed. Never run against staging/production automatically.
 * Usage: npm run db:seed:local
 *
 * Org slug must match access.ts (`orangecloud-demo`) so fixtures show up
 * for the same session org used by local/Access login.
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const now = new Date().toISOString();
const preferredOrgId = "org_syntheticdemo001";
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
const adminEmail = "admin@docops.local";
const reviewerEmail = "reviewer@docops.local";

const tmpDir = mkdtempSync(join(tmpdir(), "docops-seed-"));

type WranglerResult = Array<{
  results?: Array<Record<string, string>>;
  success?: boolean;
}>;

function runSqlFile(file: string, label: string) {
  console.log(label);
  execSync(`npx wrangler d1 execute DOCOPS_DB --local --file="${file}"`, {
    stdio: "inherit",
  });
}

function runSqlJson(sql: string): WranglerResult {
  const file = join(tmpDir, `q-${Date.now()}-${Math.random()}.sql`);
  writeFileSync(file, sql, "utf8");
  const out = execSync(
    `npx wrangler d1 execute DOCOPS_DB --local --file="${file}" --json`,
    { encoding: "utf8" },
  );
  return JSON.parse(out) as WranglerResult;
}

function firstId(result: WranglerResult): string | undefined {
  return result[0]?.results?.[0]?.id;
}

try {
  const ensureOrgFile = join(tmpDir, "ensure-org.sql");
  writeFileSync(
    ensureOrgFile,
    `
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES ('${preferredOrgId}', 'OrangeCloud Demo Org', 'orangecloud-demo', '${now}', '${now}')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  updated_at = excluded.updated_at;
`,
    "utf8",
  );
  runSqlFile(ensureOrgFile, "Ensuring local org slug orangecloud-demo…");

  const orgId =
    firstId(
      runSqlJson(
        `SELECT id FROM organizations WHERE slug = 'orangecloud-demo' LIMIT 1;`,
      ),
    ) ?? preferredOrgId;
  console.log(`Using organization id ${orgId}`);

  const existingAdmin = firstId(
    runSqlJson(
      `SELECT id FROM users WHERE organization_id = '${orgId}' AND lower(email) = lower('${adminEmail}') LIMIT 1;`,
    ),
  );
  const existingReviewer = firstId(
    runSqlJson(
      `SELECT id FROM users WHERE organization_id = '${orgId}' AND lower(email) = lower('${reviewerEmail}') LIMIT 1;`,
    ),
  );

  const adminInsertId = `usr_seed_admin_${Date.now().toString(36)}`;
  const reviewerInsertId = `usr_seed_rev_${Date.now().toString(36)}`;

  const upsertUsersFile = join(tmpDir, "upsert-users.sql");
  const userStatements: string[] = [];
  if (!existingAdmin) {
    userStatements.push(`
INSERT INTO users (id, organization_id, email, display_name, role, created_at, updated_at)
VALUES ('${adminInsertId}', '${orgId}', '${adminEmail}', 'Local Admin', 'admin', '${now}', '${now}');
`);
  } else {
    userStatements.push(`
UPDATE users SET display_name = 'Local Admin', role = 'admin', updated_at = '${now}'
WHERE id = '${existingAdmin}';
`);
  }
  if (!existingReviewer) {
    userStatements.push(`
INSERT INTO users (id, organization_id, email, display_name, role, created_at, updated_at)
VALUES ('${reviewerInsertId}', '${orgId}', '${reviewerEmail}', 'Local Reviewer', 'reviewer', '${now}', '${now}');
`);
  } else {
    userStatements.push(`
UPDATE users SET display_name = 'Local Reviewer', role = 'reviewer', updated_at = '${now}'
WHERE id = '${existingReviewer}';
`);
  }
  writeFileSync(upsertUsersFile, userStatements.join("\n"), "utf8");
  runSqlFile(upsertUsersFile, "Upserting local admin/reviewer users…");

  const adminId =
    firstId(
      runSqlJson(
        `SELECT id FROM users WHERE organization_id = '${orgId}' AND lower(email) = lower('${adminEmail}') LIMIT 1;`,
      ),
    ) ?? adminInsertId;
  console.log(`Using admin user id ${adminId}`);

  const dataFile = join(tmpDir, "seed-data.sql");
  writeFileSync(
    dataFile,
    `
PRAGMA foreign_keys = OFF;

DELETE FROM audit_events WHERE id = 'aud_syntheticseed0001';
DELETE FROM rule_results WHERE id IN ('rr_syntheticfail0001', 'rr_syntheticwarn0001');
DELETE FROM review_tasks WHERE id = '${reviewTaskId}';
DELETE FROM case_documents WHERE case_id = '${caseId}';
DELETE FROM document_versions WHERE id IN ('${contractVerId}', '${poVerId}', '${invXmlVerId}', '${invPdfVerId}');
DELETE FROM documents WHERE id IN ('${contractDocId}', '${poDocId}', '${invXmlDocId}', '${invPdfDocId}');
DELETE FROM contract_to_pay_cases WHERE id = '${caseId}';

PRAGMA foreign_keys = ON;
INSERT INTO contract_to_pay_cases (
  id, organization_id, reference, vendor_name, vendor_tax_id, status, created_by, created_at, updated_at
) VALUES (
  '${caseId}', '${orgId}', 'C2P-SYN-2026-001', 'Northern Widget Supplies LLC (SYNTHETIC)',
  'TAX-SYN-000111222', 'in_review', '${adminId}', '${now}', '${now}'
);

INSERT INTO documents (
  id, organization_id, display_name, document_type, source, status,
  current_version_id, case_id, created_by, created_at, updated_at
) VALUES
  ('${contractDocId}', '${orgId}', 'SYNTHETIC Vendor Contract MSA.pdf', 'vendor_contract', 'seed', 'APPROVED', '${contractVerId}', '${caseId}', '${adminId}', '${now}', '${now}'),
  ('${poDocId}', '${orgId}', 'SYNTHETIC Purchase Order PO-1001.pdf', 'purchase_order', 'seed', 'APPROVED', '${poVerId}', '${caseId}', '${adminId}', '${now}', '${now}'),
  ('${invXmlDocId}', '${orgId}', 'SYNTHETIC Invoice INV-9001.xml', 'invoice_xml', 'seed', 'NEEDS_REVIEW', '${invXmlVerId}', '${caseId}', '${adminId}', '${now}', '${now}'),
  ('${invPdfDocId}', '${orgId}', 'SYNTHETIC Invoice INV-9001.pdf', 'invoice_pdf', 'seed', 'NEEDS_REVIEW', '${invPdfVerId}', '${caseId}', '${adminId}', '${now}', '${now}');

INSERT INTO document_versions (
  id, document_id, version_number, r2_object_key, original_filename, mime_type,
  file_size, sha256, etag, created_by, created_at
) VALUES
  ('${contractVerId}', '${contractDocId}', 1, 'local/${orgId}/${contractDocId}/${contractVerId}/original/SYNTHETIC_Vendor_Contract_MSA.pdf', 'SYNTHETIC_Vendor_Contract_MSA.pdf', 'application/pdf', 1024, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'etag-contract', '${adminId}', '${now}'),
  ('${poVerId}', '${poDocId}', 1, 'local/${orgId}/${poDocId}/${poVerId}/original/SYNTHETIC_PO_1001.pdf', 'SYNTHETIC_PO_1001.pdf', 'application/pdf', 2048, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'etag-po', '${adminId}', '${now}'),
  ('${invXmlVerId}', '${invXmlDocId}', 1, 'local/${orgId}/${invXmlDocId}/${invXmlVerId}/original/SYNTHETIC_INV_9001.xml', 'SYNTHETIC_INV_9001.xml', 'application/xml', 512, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'etag-xml', '${adminId}', '${now}'),
  ('${invPdfVerId}', '${invPdfDocId}', 1, 'local/${orgId}/${invPdfDocId}/${invPdfVerId}/original/SYNTHETIC_INV_9001.pdf', 'SYNTHETIC_INV_9001.pdf', 'application/pdf', 3072, 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'etag-pdf', '${adminId}', '${now}');

INSERT INTO case_documents (case_id, document_id, relationship_type, created_at) VALUES
  ('${caseId}', '${contractDocId}', 'contract', '${now}'),
  ('${caseId}', '${poDocId}', 'purchase_order', '${now}'),
  ('${caseId}', '${invXmlDocId}', 'invoice', '${now}'),
  ('${caseId}', '${invPdfDocId}', 'invoice', '${now}');

INSERT INTO rule_results (
  id, case_id, document_id, rule_key, rule_version, status, severity,
  expected_value, actual_value, explanation, created_at
) VALUES
  ('rr_syntheticfail0001', '${caseId}', '${invXmlDocId}', 'invoice_within_po_value', 'v0', 'fail', 'high', '10000000', '12500000', 'SYNTHETIC: invoice total exceeds PO value (fixture exception).', '${now}'),
  ('rr_syntheticwarn0001', '${caseId}', '${invPdfDocId}', 'supplier_identity_match', 'v0', 'warning', 'medium', 'Northern Widget Supplies LLC (SYNTHETIC)', 'Northern Widget Supply', 'SYNTHETIC: vendor name fuzzy mismatch (fixture exception).', '${now}');

INSERT INTO review_tasks (
  id, organization_id, document_id, case_id, status, reason, assigned_to, created_at, updated_at, resolved_at
) VALUES (
  '${reviewTaskId}', '${orgId}', '${invXmlDocId}', '${caseId}', 'open',
  'SYNTHETIC: open review for invoice/PO amount exception.', NULL, '${now}', '${now}', NULL
);

INSERT INTO audit_events (
  id, organization_id, actor_type, actor_id, action, entity_type, entity_id, request_id, metadata_json, created_at
) VALUES
  ('aud_syntheticseed0001', '${orgId}', 'system', 'seed', 'seed.applied', 'organization', '${orgId}', 'req_seed_local', '{"synthetic":true}', '${now}');
`,
    "utf8",
  );
  runSqlFile(dataFile, "Seeding local D1 with synthetic fixtures…");
  console.log(
    `Seed complete. Org orangecloud-demo (${orgId}) · case C2P-SYN-2026-001 · review ${reviewTaskId}`,
  );
} finally {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
