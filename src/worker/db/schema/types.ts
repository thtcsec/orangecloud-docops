import type {
  CaseStatus,
  DocumentStatus,
  DocumentType,
  ProcessingRunStatus,
  RelationshipType,
  ReviewDecision,
  ReviewTaskStatus,
  RuleResultStatus,
  UserRole,
} from "@shared/domain";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type UserRow = {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  organization_id: string;
  display_name: string;
  document_type: DocumentType;
  source: string;
  status: DocumentStatus;
  current_version_id: string | null;
  case_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentVersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  r2_object_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sha256: string;
  etag: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProcessingRunRow = {
  id: string;
  document_version_id: string;
  workflow_instance_id: string | null;
  provider: string;
  provider_model: string | null;
  status: ProcessingRunStatus;
  attempt: number;
  idempotency_key: string;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export type CaseRow = {
  id: string;
  organization_id: string;
  reference: string;
  vendor_name: string | null;
  vendor_tax_id: string | null;
  status: CaseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseDocumentRow = {
  case_id: string;
  document_id: string;
  relationship_type: RelationshipType;
  created_at: string;
};

export type RuleResultRow = {
  id: string;
  case_id: string | null;
  document_id: string | null;
  rule_key: string;
  rule_version: string;
  status: RuleResultStatus;
  severity: string | null;
  expected_value: string | null;
  actual_value: string | null;
  explanation: string | null;
  created_at: string;
};

export type ReviewTaskRow = {
  id: string;
  organization_id: string;
  document_id: string | null;
  case_id: string | null;
  status: ReviewTaskStatus;
  reason: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ReviewDecisionRow = {
  id: string;
  review_task_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  comment: string | null;
  created_at: string;
};

export type AuditEventRow = {
  id: string;
  organization_id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id: string | null;
  metadata_json: string | null;
  created_at: string;
};

export type ExtractedFieldRow = {
  id: string;
  processing_run_id: string;
  document_version_id: string;
  field_name: string;
  raw_value: string | null;
  normalized_value: string | null;
  value_type: string | null;
  confidence: number | null;
  source_kind: string | null;
  source_reference: string | null;
  provider: string | null;
  model_version: string | null;
  created_at: string;
};
