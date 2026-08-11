-- Organization key/value settings (integration config, etc.)
CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_org_settings_org
  ON organization_settings (organization_id);
