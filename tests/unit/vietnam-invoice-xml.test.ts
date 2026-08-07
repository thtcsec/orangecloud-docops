import { describe, expect, it } from "vitest";
import { parseVietnamInvoiceXmlText } from "../../src/worker/providers/vietnam-invoice-xml";

describe("parseVietnamInvoiceXmlText", () => {
  it("extracts fields from a synthetic smoke invoice", () => {
    const xml = `<?xml version="1.0"?><Invoice><Synthetic>true</Synthetic><Number>INV-SMOKE-1</Number><Total>1100000</Total><TaxAmount>100000</TaxAmount><SubTotal>1000000</SubTotal><SellerTaxCode>0123456789</SellerTaxCode></Invoice>`;
    const result = parseVietnamInvoiceXmlText(xml);
    expect(result.configured).toBe(true);
    expect(result.provider).toBe("vietnam-invoice-xml");
    const map = Object.fromEntries(
      result.fields.map((f) => [f.fieldName, f.normalizedValue]),
    );
    expect(map.invoice_number).toBe("INV-SMOKE-1");
    expect(map.total_amount).toBe("1100000.00");
    expect(map.tax_amount).toBe("100000.00");
    expect(map.subtotal).toBe("1000000.00");
    expect(map.vendor_tax_id).toBe("0123456789");
  });

  it("returns empty fields for unknown XML shape without inventing values", () => {
    const result = parseVietnamInvoiceXmlText("<root><foo>bar</foo></root>");
    expect(result.fields).toEqual([]);
    expect(result.message).toMatch(/no known invoice fields/i);
  });
});
