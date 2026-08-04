export const USER_ROLES = ["admin", "reviewer", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DOCUMENT_TYPES = [
  "vendor_contract",
  "purchase_order",
  "invoice_xml",
  "invoice_pdf",
  "unknown",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "UPLOADING",
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "EXTRACTED",
  "VALIDATING",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPORTING",
  "EXPORTED",
  "FAILED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const CASE_STATUSES = [
  "open",
  "in_review",
  "approved",
  "rejected",
  "exported",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const RELATIONSHIP_TYPES = [
  "contract",
  "purchase_order",
  "invoice",
  "supporting_document",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RULE_RESULT_STATUSES = [
  "pass",
  "warning",
  "fail",
  "not_applicable",
  "not_evaluated",
] as const;
export type RuleResultStatus = (typeof RULE_RESULT_STATUSES)[number];

export const REVIEW_TASK_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "cancelled",
] as const;
export type ReviewTaskStatus = (typeof REVIEW_TASK_STATUSES)[number];

export const REVIEW_DECISIONS = [
  "approved",
  "rejected",
  "correction_requested",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const PROCESSING_RUN_STATUSES = [
  "pending",
  "running",
  "waiting_review",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ProcessingRunStatus = (typeof PROCESSING_RUN_STATUSES)[number];

export const PLANNED_RULES = [
  {
    key: "supplier_identity_match",
    name: "Supplier identity match",
    description:
      "Vendor name and tax ID on the invoice must match the linked contract.",
  },
  {
    key: "invoice_contract_date_valid",
    name: "Invoice date within contract term",
    description:
      "Invoice issue date must fall within the contract effective period.",
  },
  {
    key: "invoice_within_contract_ceiling",
    name: "Invoice within contract ceiling",
    description:
      "Cumulative invoice amounts must not exceed the contract value ceiling.",
  },
  {
    key: "invoice_within_po_value",
    name: "Invoice within PO value",
    description:
      "Invoice total must not exceed the linked purchase order value.",
  },
  {
    key: "invoice_arithmetic_valid",
    name: "Invoice arithmetic valid",
    description:
      "Line items, tax, and totals must be arithmetically consistent.",
  },
  {
    key: "payment_term_match",
    name: "Payment term match",
    description:
      "Invoice payment terms must align with the contract payment terms.",
  },
  {
    key: "duplicate_invoice_check",
    name: "Duplicate invoice check",
    description:
      "Invoice number + vendor tax ID must be unique within the organization.",
  },
  {
    key: "invoice_xml_pdf_consistency",
    name: "Invoice XML/PDF consistency",
    description:
      "Structured XML invoice fields must be consistent with the PDF representation.",
  },
] as const;

export const PLANNED_INTEGRATIONS = [
  {
    key: "workers_ai",
    name: "Workers AI",
    description: "Baseline extraction for unstructured PDF contracts and POs.",
    status: "unavailable" as const,
  },
  {
    key: "azure_document_intelligence",
    name: "Azure Document Intelligence",
    description: "External extraction provider adapter (Phase 2+).",
    status: "unavailable" as const,
  },
  {
    key: "google_document_ai",
    name: "Google Document AI",
    description: "External extraction provider adapter (Phase 2+).",
    status: "unavailable" as const,
  },
  {
    key: "erp_webhook",
    name: "ERP webhook",
    description: "Export approved results to an existing ERP system.",
    status: "unavailable" as const,
  },
  {
    key: "misa_accounting",
    name: "MISA / accounting integration",
    description: "Accounting export adapter for Vietnamese finance systems.",
    status: "unavailable" as const,
  },
  {
    key: "clm_integration",
    name: "CLM integration",
    description: "Contract Lifecycle Management system connector.",
    status: "unavailable" as const,
  },
] as const;

export type ApiSuccess<T> = {
  ok: true;
  requestId: string;
  data: T;
};

export type ApiFailure = {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
