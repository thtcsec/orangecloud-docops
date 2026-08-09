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

  it("extracts nested HDon seller/buyer Ten and MST without mixing", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <SHDon>INV-SYN-9001</SHDon>
      <NLap>2026-07-15</NLap>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>Northern Widget Supplies LLC (SYNTHETIC)</Ten>
        <MST>TAX-SYN-000111222</MST>
      </NBan>
      <NMua>
        <Ten>Acme Synthetic Trading Co.</Ten>
        <MST>TAX-SYN-999888777</MST>
      </NMua>
      <TgTTTBSo>12500000</TgTTTBSo>
    </NDHDon>
  </DLHDon>
</HDon>`;
    const result = parseVietnamInvoiceXmlText(xml);
    const map = Object.fromEntries(
      result.fields.map((f) => [f.fieldName, f.normalizedValue]),
    );
    expect(map.invoice_number).toBe("INV-SYN-9001");
    expect(map.vendor_name).toBe("Northern Widget Supplies LLC (SYNTHETIC)");
    expect(map.vendor_tax_id).toBe("TAX-SYN-000111222");
    expect(map.buyer_name).toBe("Acme Synthetic Trading Co.");
    expect(map.buyer_tax_id).toBe("TAX-SYN-999888777");
    expect(map.total_amount).toBe("12500000.00");
  });
});
