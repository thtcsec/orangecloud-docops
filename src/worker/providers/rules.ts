import type { Db } from "../db/repositories/base";
import { first } from "../db/repositories/base";
import type { ExtractedField, EvaluatedRule, RuleEvaluationResult } from "./types";

const RULE_VERSION = "v1";

function fieldMap(fields: ExtractedField[]): Map<string, ExtractedField> {
  return new Map(fields.map((f) => [f.fieldName, f]));
}

function money(fields: Map<string, ExtractedField>, name: string): number | null {
  const v = fields.get(name)?.normalizedValue;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function evaluateArithmetic(fields: Map<string, ExtractedField>): EvaluatedRule {
  const subtotal = money(fields, "subtotal");
  const tax = money(fields, "tax_amount");
  const total = money(fields, "total_amount");

  if (subtotal == null || tax == null || total == null) {
    return {
      ruleKey: "invoice_arithmetic_valid",
      ruleVersion: RULE_VERSION,
      status: "not_applicable",
      severity: null,
      expectedValue: null,
      actualValue: null,
      explanation:
        "Needs subtotal, tax_amount, and total_amount to check arithmetic.",
    };
  }

  const expected = Number((subtotal + tax).toFixed(2));
  const delta = Math.abs(expected - total);
  const ok = delta <= 0.05;

  return {
    ruleKey: "invoice_arithmetic_valid",
    ruleVersion: RULE_VERSION,
    status: ok ? "pass" : "fail",
    severity: ok ? "info" : "error",
    expectedValue: expected.toFixed(2),
    actualValue: total.toFixed(2),
    explanation: ok
      ? "Subtotal + tax matches invoice total."
      : `Subtotal + tax (${expected.toFixed(2)}) does not match total (${total.toFixed(2)}).`,
  };
}

function evaluateXmlPdfConsistency(
  fields: Map<string, ExtractedField>,
): EvaluatedRule {
  const hasCore =
    Boolean(fields.get("invoice_number")?.normalizedValue) &&
    Boolean(fields.get("total_amount")?.normalizedValue);

  if (!hasCore) {
    return {
      ruleKey: "invoice_xml_pdf_consistency",
      ruleVersion: RULE_VERSION,
      status: "warning",
      severity: "warning",
      expectedValue: "invoice_number,total_amount",
      actualValue: null,
      explanation:
        "XML is missing core invoice fields — cannot assert consistency yet.",
    };
  }

  return {
    ruleKey: "invoice_xml_pdf_consistency",
    ruleVersion: RULE_VERSION,
    status: "not_applicable",
    severity: null,
    expectedValue: null,
    actualValue: null,
    explanation:
      "No PDF counterpart in this run — XML-only consistency check skipped.",
  };
}

async function evaluateDuplicate(
  db: Db,
  organizationId: string,
  documentId: string,
  fields: Map<string, ExtractedField>,
): Promise<EvaluatedRule> {
  const invoiceNumber = fields.get("invoice_number")?.normalizedValue;
  const vendorTaxId = fields.get("vendor_tax_id")?.normalizedValue;

  if (!invoiceNumber) {
    return {
      ruleKey: "duplicate_invoice_check",
      ruleVersion: RULE_VERSION,
      status: "not_applicable",
      severity: null,
      expectedValue: null,
      actualValue: null,
      explanation: "No invoice_number extracted — duplicate check skipped.",
    };
  }

  // Match other documents in the org that share invoice_number (and tax id when present).
  const row = await first<{ document_id: string }>(
    db
      .prepare(
        `SELECT d.id as document_id
         FROM extracted_fields ef
         JOIN document_versions dv ON dv.id = ef.document_version_id
         JOIN documents d ON d.id = dv.document_id
         WHERE d.organization_id = ?
           AND d.id != ?
           AND ef.field_name = 'invoice_number'
           AND ef.normalized_value = ?
         LIMIT 1`,
      )
      .bind(organizationId, documentId, invoiceNumber),
  );

  if (row && vendorTaxId) {
    const taxMatch = await first<{ document_id: string }>(
      db
        .prepare(
          `SELECT d.id as document_id
           FROM extracted_fields ef
           JOIN document_versions dv ON dv.id = ef.document_version_id
           JOIN documents d ON d.id = dv.document_id
           WHERE d.organization_id = ?
             AND d.id = ?
             AND ef.field_name = 'vendor_tax_id'
             AND ef.normalized_value = ?
           LIMIT 1`,
        )
        .bind(organizationId, row.document_id, vendorTaxId),
    );
    if (taxMatch) {
      return {
        ruleKey: "duplicate_invoice_check",
        ruleVersion: RULE_VERSION,
        status: "fail",
        severity: "error",
        expectedValue: "unique invoice_number + vendor_tax_id",
        actualValue: `${invoiceNumber} / ${vendorTaxId}`,
        explanation: `Possible duplicate of document ${row.document_id}.`,
      };
    }
  } else if (row) {
    return {
      ruleKey: "duplicate_invoice_check",
      ruleVersion: RULE_VERSION,
      status: "warning",
      severity: "warning",
      expectedValue: "unique invoice_number",
      actualValue: invoiceNumber,
      explanation: `Another document already has invoice_number ${invoiceNumber}.`,
    };
  }

  return {
    ruleKey: "duplicate_invoice_check",
    ruleVersion: RULE_VERSION,
    status: "pass",
    severity: "info",
    expectedValue: "unique",
    actualValue: invoiceNumber,
    explanation: "No duplicate invoice_number found in this organization.",
  };
}

async function evaluateSupplierMatch(
  db: Db,
  caseId: string | null,
  fields: Map<string, ExtractedField>,
): Promise<EvaluatedRule> {
  if (!caseId) {
    return {
      ruleKey: "supplier_identity_match",
      ruleVersion: RULE_VERSION,
      status: "not_applicable",
      severity: null,
      expectedValue: null,
      actualValue: null,
      explanation: "Document is not linked to a Contract-to-Pay case.",
    };
  }

  const caseRow = await first<{
    vendor_name: string | null;
    vendor_tax_id: string | null;
  }>(
    db
      .prepare(
        `SELECT vendor_name, vendor_tax_id FROM contract_to_pay_cases WHERE id = ?`,
      )
      .bind(caseId),
  );

  const actualTax = fields.get("vendor_tax_id")?.normalizedValue;
  const actualName = fields.get("vendor_name")?.normalizedValue;
  const expectedTax = caseRow?.vendor_tax_id?.trim() || null;
  const expectedName = caseRow?.vendor_name?.trim() || null;

  if (!expectedTax && !expectedName) {
    return {
      ruleKey: "supplier_identity_match",
      ruleVersion: RULE_VERSION,
      status: "not_applicable",
      severity: null,
      expectedValue: null,
      actualValue: actualTax ?? actualName ?? null,
      explanation: "Case has no vendor identity to compare against.",
    };
  }

  if (expectedTax && actualTax) {
    const ok = expectedTax.replace(/\s/g, "") === actualTax.replace(/\s/g, "");
    return {
      ruleKey: "supplier_identity_match",
      ruleVersion: RULE_VERSION,
      status: ok ? "pass" : "fail",
      severity: ok ? "info" : "error",
      expectedValue: expectedTax,
      actualValue: actualTax,
      explanation: ok
        ? "Vendor tax ID matches the case."
        : "Vendor tax ID does not match the linked case.",
    };
  }

  if (expectedName && actualName) {
    const ok =
      expectedName.toLowerCase() === actualName.toLowerCase();
    return {
      ruleKey: "supplier_identity_match",
      ruleVersion: RULE_VERSION,
      status: ok ? "pass" : "warning",
      severity: ok ? "info" : "warning",
      expectedValue: expectedName,
      actualValue: actualName,
      explanation: ok
        ? "Vendor name matches the case."
        : "Vendor name differs from the linked case (tax ID unavailable).",
    };
  }

  return {
    ruleKey: "supplier_identity_match",
    ruleVersion: RULE_VERSION,
    status: "warning",
    severity: "warning",
    expectedValue: expectedTax ?? expectedName ?? null,
    actualValue: actualTax ?? actualName ?? null,
    explanation: "Could not fully compare supplier identity — partial data.",
  };
}

export const IMPLEMENTED_RULE_KEYS = [
  "supplier_identity_match",
  "invoice_arithmetic_valid",
  "duplicate_invoice_check",
  "invoice_xml_pdf_consistency",
] as const;

export async function evaluateDocumentRules(input: {
  db: Db;
  organizationId: string;
  documentId: string;
  caseId: string | null;
  fields: ExtractedField[];
}): Promise<RuleEvaluationResult> {
  const map = fieldMap(input.fields);
  const results: EvaluatedRule[] = [
    evaluateArithmetic(map),
    evaluateXmlPdfConsistency(map),
    await evaluateDuplicate(
      input.db,
      input.organizationId,
      input.documentId,
      map,
    ),
    await evaluateSupplierMatch(input.db, input.caseId, map),
  ];

  // Mark remaining planned rules as not_evaluated for transparency.
  const done = new Set(results.map((r) => r.ruleKey));
  for (const key of [
    "invoice_contract_date_valid",
    "invoice_within_contract_ceiling",
    "invoice_within_po_value",
    "payment_term_match",
  ] as const) {
    if (done.has(key)) continue;
    results.push({
      ruleKey: key,
      ruleVersion: RULE_VERSION,
      status: "not_evaluated",
      severity: null,
      expectedValue: null,
      actualValue: null,
      explanation: "Needs linked case amounts / contract terms (later phase).",
    });
  }

  return {
    configured: true,
    results,
    message: `Evaluated ${results.length} rule(s)`,
  };
}
