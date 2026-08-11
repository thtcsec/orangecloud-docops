import { describe, expect, it } from "vitest";
import {
  mapInvoiceJsonToFields,
  normalizeMoneyString,
} from "../../src/worker/providers/workers-ai-pdf";

describe("workers-ai-pdf field mapping", () => {
  it("normalizes VN and US money formats", () => {
    expect(normalizeMoneyString("1.234.567,89")).toBe("1234567.89");
    expect(normalizeMoneyString("1,234,567.89")).toBe("1234567.89");
    expect(normalizeMoneyString("1100000")).toBe("1100000.00");
  });

  it("maps invoice JSON into ExtractedField list", () => {
    const fields = mapInvoiceJsonToFields({
      invoice_number: "INV-1",
      vendor_tax_id: "0123456789",
      subtotal: "1000000",
      tax_amount: "100000",
      total_amount: "1.100.000",
      missing: "x",
    });
    const names = fields.map((f) => f.fieldName);
    expect(names).toContain("invoice_number");
    expect(names).toContain("vendor_tax_id");
    expect(names).toContain("total_amount");
    expect(fields.find((f) => f.fieldName === "total_amount")?.normalizedValue).toBe(
      "1100000.00",
    );
    expect(fields.every((f) => f.sourceKind === "ai")).toBe(true);
  });

  it("skips empty and null-like values", () => {
    expect(mapInvoiceJsonToFields({ invoice_number: "null", vendor_name: "" })).toEqual(
      [],
    );
  });
});
