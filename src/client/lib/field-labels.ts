/** Human-readable labels for extracted invoice field keys. */

const FIELD_EN: Record<string, string> = {
  invoice_number: "Invoice number",
  invoice_symbol: "Invoice symbol",
  invoice_date: "Invoice date",
  vendor_name: "Vendor name",
  vendor_tax_id: "Vendor tax ID",
  buyer_name: "Buyer name",
  buyer_tax_id: "Buyer tax ID",
  currency: "Currency",
  subtotal: "Subtotal",
  tax_amount: "Tax amount",
  total_amount: "Total amount",
  payment_terms: "Payment terms",
};

const FIELD_VI: Record<string, string> = {
  invoice_number: "Số hoá đơn",
  invoice_symbol: "Ký hiệu hoá đơn",
  invoice_date: "Ngày hoá đơn",
  vendor_name: "Tên nhà cung cấp",
  vendor_tax_id: "MST nhà cung cấp",
  buyer_name: "Tên người mua",
  buyer_tax_id: "MST người mua",
  currency: "Tiền tệ",
  subtotal: "Tiền trước thuế",
  tax_amount: "Tiền thuế",
  total_amount: "Tổng thanh toán",
  payment_terms: "Điều khoản thanh toán",
};

const RULE_STATUS_EN: Record<string, string> = {
  pass: "Pass",
  warning: "Warning",
  fail: "Fail",
  not_applicable: "Skipped — missing data",
  not_evaluated: "Later phase",
};

const RULE_STATUS_VI: Record<string, string> = {
  pass: "Đạt",
  warning: "Cảnh báo",
  fail: "Không đạt",
  not_applicable: "Bỏ qua — thiếu dữ liệu",
  not_evaluated: "Giai đoạn sau",
};

export function formatFieldLabel(fieldName: string, locale: string): string {
  const map = locale.startsWith("vi") ? FIELD_VI : FIELD_EN;
  return map[fieldName] || fieldName.replace(/_/g, " ");
}

export function formatRuleStatusLabel(status: string, locale: string): string {
  const map = locale.startsWith("vi") ? RULE_STATUS_VI : RULE_STATUS_EN;
  return map[status] || status;
}

/** Whether a rule result is informational (not a real fail/warn). */
export function isInformationalRuleStatus(status: string): boolean {
  return status === "not_applicable" || status === "not_evaluated";
}
