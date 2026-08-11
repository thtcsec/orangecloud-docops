import { describe, expect, it } from "vitest";
import {
  patchCaseSchema,
  patchDocumentSchema,
  patchExtractedFieldSchema,
  exportDocumentsQuerySchema,
} from "../../src/worker/api/schemas/common";
import { evaluateDocumentRules } from "../../src/worker/providers/rules";
import type { ExtractedField } from "../../src/worker/providers/types";

describe("Case and Document CRUD Validation Schemas", () => {
  it("validates patchCaseSchema inputs", () => {
    const valid = patchCaseSchema.parse({
      reference: "CASE-2026-001",
      vendorName: "Công ty TNHH C2P Tech",
      vendorTaxId: "0109998888",
      status: "approved",
    });
    expect(valid.reference).toBe("CASE-2026-001");
    expect(valid.status).toBe("approved");

    const partial = patchCaseSchema.parse({
      status: "in_review",
    });
    expect(partial.status).toBe("in_review");
    expect(partial.reference).toBeUndefined();

    expect(() =>
      patchCaseSchema.parse({
        status: "invalid_status",
      }),
    ).toThrow();
  });

  it("validates patchDocumentSchema inputs", () => {
    const valid = patchDocumentSchema.parse({
      displayName: "HD_DichVu_Thang8.pdf",
      documentType: "vendor_contract",
    });
    expect(valid.displayName).toBe("HD_DichVu_Thang8.pdf");
    expect(valid.documentType).toBe("vendor_contract");

    expect(() =>
      patchDocumentSchema.parse({
        documentType: "non_existent_type",
      }),
    ).toThrow();
  });

  it("validates patchExtractedFieldSchema inputs", () => {
    const valid = patchExtractedFieldSchema.parse({
      normalizedValue: "15000000",
    });
    expect(valid.normalizedValue).toBe("15000000");

    const clearField = patchExtractedFieldSchema.parse({
      normalizedValue: null,
    });
    expect(clearField.normalizedValue).toBeNull();
  });

  it("validates exportDocumentsQuerySchema parameters", () => {
    const valid = exportDocumentsQuerySchema.parse({
      status: "APPROVED",
      documentType: "invoice_xml",
      search: "VNPT",
    });
    expect(valid.status).toBe("APPROVED");
    expect(valid.documentType).toBe("invoice_xml");

    const empty = exportDocumentsQuerySchema.parse({});
    expect(empty.status).toBeUndefined();
  });
});

describe("Manual Field Override & Dynamic Rule Re-evaluation", () => {
  it("re-evaluates arithmetic rules correctly after reviewer overrides an extracted amount", async () => {
    const stubDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({ success: true }),
          all: async () => ({ results: [] }),
        }),
      }),
    };

    // Before manual correction (OCR misread 110.00 as 100.00)
    const misreadFields: ExtractedField[] = [
      {
        fieldName: "subtotal",
        rawValue: "100.00",
        normalizedValue: "100.00",
        valueType: "money",
        confidence: 0.98,
        sourceKind: "ocr",
      },
      {
        fieldName: "tax_amount",
        rawValue: "10.00",
        normalizedValue: "10.00",
        valueType: "money",
        confidence: 0.99,
        sourceKind: "ocr",
      },
      {
        fieldName: "total_amount",
        rawValue: "100.00", // Error in OCR
        normalizedValue: "100.00",
        valueType: "money",
        confidence: 0.72,
        sourceKind: "ocr",
      },
      {
        fieldName: "invoice_number",
        rawValue: "INV-2026-99",
        normalizedValue: "INV-2026-99",
        valueType: "string",
        confidence: 0.99,
        sourceKind: "ocr",
      },
    ];

    const initialResult = await evaluateDocumentRules({
      db: stubDb as never,
      organizationId: "org_test",
      documentId: "doc_test",
      caseId: null,
      fields: misreadFields,
    });

    const initialArithmetic = initialResult.results.find(
      (r) => r.ruleKey === "invoice_arithmetic_valid",
    );
    expect(initialArithmetic?.status).toBe("fail");

    // After Reviewer manual override: total_amount corrected to 110.00 with sourceKind "manual_override"
    const correctedFields: ExtractedField[] = misreadFields.map((f) =>
      f.fieldName === "total_amount"
        ? {
            ...f,
            normalizedValue: "110.00",
            sourceKind: "manual_override",
            confidence: 1.0,
          }
        : f,
    );

    const reEvaluatedResult = await evaluateDocumentRules({
      db: stubDb as never,
      organizationId: "org_test",
      documentId: "doc_test",
      caseId: null,
      fields: correctedFields,
    });

    const reEvaluatedArithmetic = reEvaluatedResult.results.find(
      (r) => r.ruleKey === "invoice_arithmetic_valid",
    );
    expect(reEvaluatedArithmetic?.status).toBe("pass");
    expect(reEvaluatedResult.overallStatus).not.toBe("FAIL");
  });
});

describe("CSV Export Formatting Specification", () => {
  it("escapes CSV values with double quotes, commas, and multiline strings according to RFC 4180", () => {
    function escapeCsvCell(val: string | number | null | undefined): string {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    expect(escapeCsvCell("Công ty TNHH Giải Pháp, Số 1")).toBe(
      '"Công ty TNHH Giải Pháp, Số 1"',
    );
    expect(escapeCsvCell('Hợp đồng "Đặc biệt"')).toBe('"Hợp đồng ""Đặc biệt"""');
    expect(escapeCsvCell("Dòng 1\nDòng 2")).toBe('"Dòng 1\nDòng 2"');
    expect(escapeCsvCell(15000000)).toBe("15000000");
    expect(escapeCsvCell(null)).toBe("");
  });
});
