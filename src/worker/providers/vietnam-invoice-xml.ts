import type { ExtractionResult, ExtractedField } from "./types";

/**
 * Deterministic Vietnamese e-invoice XML parser (Phase 1.5).
 * Tag-tolerant: works with synthetic fixtures and common HĐĐT-style names.
 * Does not invent values — only returns fields found in the XML text.
 */

const FIELD_TAGS: Record<
  string,
  {
    tags: string[];
    valueType: ExtractedField["valueType"];
    nested?: { parent: string; child: string };
  }
> = {
  invoice_number: {
    tags: [
      "Number",
      "InvoiceNumber",
      "SHDon",
      "SoHoaDon",
      "soHoaDon",
      "InvoiceNo",
      "SHD",
    ],
    valueType: "string",
  },
  invoice_symbol: {
    tags: ["KHMSHDon", "KHHDon", "Series", "InvoiceSeries", "KyHieu"],
    valueType: "string",
  },
  invoice_date: {
    tags: [
      "InvoiceDate",
      "NLap",
      "NgayLap",
      "IssueDate",
      "NgayHoaDon",
      "Date",
    ],
    valueType: "date",
  },
  vendor_name: {
    tags: [
      "SellerName",
      "TenNBan",
      "VendorName",
      "SupplierName",
      "Seller",
    ],
    valueType: "string",
    nested: { parent: "NBan", child: "Ten" },
  },
  vendor_tax_id: {
    tags: [
      "SellerTaxCode",
      "MSTNBan",
      "MaSoThue",
      "TaxCode",
      "VendorTaxId",
      "SellerTIN",
      "MST",
    ],
    valueType: "string",
    nested: { parent: "NBan", child: "MST" },
  },
  buyer_name: {
    tags: ["BuyerName", "TenNMua", "CustomerName", "Buyer"],
    valueType: "string",
    nested: { parent: "NMua", child: "Ten" },
  },
  buyer_tax_id: {
    tags: ["BuyerTaxCode", "MSTNMua", "BuyerTIN"],
    valueType: "string",
    nested: { parent: "NMua", child: "MST" },
  },
  currency: {
    tags: ["Currency", "DVTTe", "CurrencyCode"],
    valueType: "string",
  },
  subtotal: {
    tags: [
      "SubTotal",
      "TgTCThue",
      "TongTienTruocThue",
      "AmountBeforeTax",
      "NetAmount",
    ],
    valueType: "money",
  },
  tax_amount: {
    tags: ["TaxAmount", "TgTThue", "TienThue", "VATAmount", "ThueGTGT"],
    valueType: "money",
  },
  total_amount: {
    tags: [
      "Total",
      "TotalAmount",
      "TgTTTBSo",
      "TongTien",
      "GrandTotal",
      "Amount",
      "ThanhTien",
    ],
    valueType: "money",
  },
  payment_terms: {
    tags: ["PaymentTerms", "HThuc", "DieuKhoanThanhToan"],
    valueType: "string",
  },
};

function firstTagValue(
  xml: string,
  tags: string[],
): { value: string; tag: string } | null {
  for (const tag of tags) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${escaped}>`,
      "i",
    );
    const match = xml.match(re);
    const inner = match?.[1]?.trim();
    if (!inner) continue;
    // Prefer leaf text; strip nested tags if any.
    const leaf = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (leaf) return { value: leaf, tag };
  }
  return null;
}

function nestedTagValue(
  xml: string,
  parent: string,
  child: string,
): { value: string; tag: string } | null {
  const parentEsc = parent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const childEsc = child.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${parentEsc}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${parentEsc}>`,
    "i",
  );
  const parentMatch = xml.match(re);
  if (!parentMatch?.[1]) return null;
  const childRe = new RegExp(
    `<(?:[\\w.-]+:)?${childEsc}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${childEsc}>`,
    "i",
  );
  const childMatch = parentMatch[1].match(childRe);
  const leaf = childMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!leaf) return null;
  return { value: leaf, tag: `${parent}/${child}` };
}

function normalizeMoney(raw: string): string | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function normalizeDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return raw.trim() || null;
}

export function parseVietnamInvoiceXmlText(xml: string): ExtractionResult {
  if (!xml.trim()) {
    return {
      configured: true,
      provider: "vietnam-invoice-xml",
      fields: [],
      message: "Empty XML payload",
    };
  }

  const fields: ExtractedField[] = [];

  for (const [fieldName, spec] of Object.entries(FIELD_TAGS)) {
    const hit =
      (spec.nested
        ? nestedTagValue(xml, spec.nested.parent, spec.nested.child)
        : null) || firstTagValue(xml, spec.tags);
    if (!hit) continue;

    let normalized: string | null = hit.value;
    if (spec.valueType === "money") {
      normalized = normalizeMoney(hit.value);
    } else if (spec.valueType === "date") {
      normalized = normalizeDate(hit.value);
    }

    fields.push({
      fieldName,
      rawValue: hit.value,
      normalizedValue: normalized,
      valueType: spec.valueType,
      confidence: 0.9,
      sourceKind: "xml",
      sourceReference: hit.tag,
    });
  }
  return {
    configured: true,
    provider: "vietnam-invoice-xml",
    fields,
    message:
      fields.length > 0
        ? `Parsed ${fields.length} field(s) from invoice XML`
        : "XML parsed but no known invoice fields were found",
  };
}

export class VietnamInvoiceXmlParser {
  async parse(input: { xmlText: string }): Promise<ExtractionResult> {
    return parseVietnamInvoiceXmlText(input.xmlText);
  }
}
