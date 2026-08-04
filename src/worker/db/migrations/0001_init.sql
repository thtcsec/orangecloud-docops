-- OrangeCloud DocOps Phase 1 schema
-- All business tables include organization_id (or join via parent) for future tenancy.

PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'viewer')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, email)
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE contract_to_pay_cases (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  reference TEXT NOT NULL,
  vendor_name TEXT,
  vendor_tax_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_review', 'approved', 'rejected', 'exported')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, reference)
);

CREATE INDEX idx_cases_org ON contract_to_pay_cases(organization_id);
CREATE INDEX idx_cases_status ON contract_to_pay_cases(organization_id, status);

CREATE TABLE documents (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  display_name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'vendor_contract',
      'purchase_order',
      'invoice_xml',
      'invoice_pdf',
      'unknown'
    )
  ),
  source TEXT NOT NULL DEFAULT 'upload',
  status TEXT NOT NULL CHECK (
    status IN (
      'UPLOADING',
      'UPLOADED',
      'QUEUED',
      'PROCESSING',
      'EXTRACTED',
      'VALIDATING',
      'NEEDS_REVIEW',
      'APPROVED',
      'REJECTED',
      'EXPORTING',
      'EXPORTED',
      'FAILED'
    )
  ),
  current_version_id TEXT,
  case_id TEXT REFERENCES contract_to_pay_cases(id),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_type ON documents(organization_id, document_type);
CREATE INDEX idx_documents_case ON documents(case_id);
CREATE INDEX idx_documents_created ON documents(organization_id, created_at);

CREATE TABLE document_versions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id),
  version_number INTEGER NOT NULL,
  r2_object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  etag TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (document_id, version_number)
);

CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
CREATE INDEX idx_document_versions_sha ON document_versions(sha256);

-- Deferred FK for current_version_id to avoid circular create ordering issues.
-- Enforced at application layer; version rows always reference documents.

CREATE TABLE processing_runs (
  id TEXT PRIMARY KEY NOT NULL,
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  workflow_instance_id TEXT,
  provider TEXT NOT NULL DEFAULT 'none',
  provider_model TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'running', 'waiting_review', 'completed', 'failed', 'cancelled')
  ),
  attempt INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,
  started_at TEXT,
  completed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_processing_runs_version ON processing_runs(document_version_id);
CREATE INDEX idx_processing_runs_status ON processing_runs(status);

CREATE TABLE extracted_fields (
  id TEXT PRIMARY KEY NOT NULL,
  processing_run_id TEXT NOT NULL REFERENCES processing_runs(id),
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  field_name TEXT NOT NULL,
  raw_value TEXT,
  normalized_value TEXT,
  value_type TEXT,
  confidence REAL,
  source_kind TEXT,
  source_reference TEXT,
  provider TEXT,
  model_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_extracted_fields_run ON extracted_fields(processing_run_id);
CREATE INDEX idx_extracted_fields_version ON extracted_fields(document_version_id);

CREATE TABLE case_documents (
  case_id TEXT NOT NULL REFERENCES contract_to_pay_cases(id),
  document_id TEXT NOT NULL REFERENCES documents(id),
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN ('contract', 'purchase_order', 'invoice', 'supporting_document')
  ),
  created_at TEXT NOT NULL,
  PRIMARY KEY (case_id, document_id)
);

CREATE INDEX idx_case_documents_doc ON case_documents(document_id);

CREATE TABLE rule_results (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT REFERENCES contract_to_pay_cases(id),
  document_id TEXT REFERENCES documents(id),
  rule_key TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pass', 'warning', 'fail', 'not_applicable', 'not_evaluated')
  ),
  severity TEXT,
  expected_value TEXT,
  actual_value TEXT,
  explanation TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_rule_results_case ON rule_results(case_id);
CREATE INDEX idx_rule_results_document ON rule_results(document_id);

CREATE TABLE review_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  document_id TEXT REFERENCES documents(id),
  case_id TEXT REFERENCES contract_to_pay_cases(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  reason TEXT NOT NULL,
  assigned_to TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX idx_review_tasks_org_status ON review_tasks(organization_id, status);
CREATE INDEX idx_review_tasks_document ON review_tasks(document_id);

CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  review_task_id TEXT NOT NULL REFERENCES review_tasks(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'correction_requested')),
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_review_decisions_task ON review_decisions(review_task_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_org_created ON audit_events(organization_id, created_at);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_events(actor_id);
CREATE INDEX idx_audit_action ON audit_events(action);
