-- Additive indexes for hot list / duplicate-rule / audit queries.
-- Safe to apply on existing Phase 1 databases (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_cases_org_updated
  ON contract_to_pay_cases(organization_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_documents_org_updated
  ON documents(organization_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_extracted_fields_name_value
  ON extracted_fields(field_name, normalized_value);

CREATE INDEX IF NOT EXISTS idx_audit_org_action_created
  ON audit_events(organization_id, action, created_at);

CREATE INDEX IF NOT EXISTS idx_review_tasks_org_updated
  ON review_tasks(organization_id, updated_at);
