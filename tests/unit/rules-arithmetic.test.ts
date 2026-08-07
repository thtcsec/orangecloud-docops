import { describe, expect, it } from "vitest";
import { evaluateDocumentRules } from "../../src/worker/providers/rules";
import type { ExtractedField } from "../../src/worker/providers/types";

function field(
  fieldName: string,
  normalizedValue: string,
): ExtractedField {
  return {
    fieldName,
    rawValue: normalizedValue,
    normalizedValue,
    valueType: "money",
    confidence: 1,
    sourceKind: "xml",
  };
}

describe("evaluateDocumentRules arithmetic", () => {
  it("passes when subtotal + tax equals total", async () => {
    const stubDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({ success: true }),
          all: async () => ({ results: [] }),
        }),
      }),
    };

    const result = await evaluateDocumentRules({
      db: stubDb as never,
      organizationId: "org_x",
      documentId: "doc_x",
      caseId: null,
      fields: [
        field("subtotal", "100.00"),
        field("tax_amount", "10.00"),
        field("total_amount", "110.00"),
        {
          fieldName: "invoice_number",
          rawValue: "INV-1",
          normalizedValue: "INV-1",
          valueType: "string",
          confidence: 1,
          sourceKind: "xml",
        },
      ],
    });

    const arithmetic = result.results.find(
      (r) => r.ruleKey === "invoice_arithmetic_valid",
    );
    expect(arithmetic?.status).toBe("pass");
  });

  it("fails when totals disagree", async () => {
    const stubDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({ success: true }),
          all: async () => ({ results: [] }),
        }),
      }),
    };

    const result = await evaluateDocumentRules({
      db: stubDb as never,
      organizationId: "org_x",
      documentId: "doc_x",
      caseId: null,
      fields: [
        field("subtotal", "100.00"),
        field("tax_amount", "10.00"),
        field("total_amount", "999.00"),
        {
          fieldName: "invoice_number",
          rawValue: "INV-2",
          normalizedValue: "INV-2",
          valueType: "string",
          confidence: 1,
          sourceKind: "xml",
        },
      ],
    });

    const arithmetic = result.results.find(
      (r) => r.ruleKey === "invoice_arithmetic_valid",
    );
    expect(arithmetic?.status).toBe("fail");
  });
});
