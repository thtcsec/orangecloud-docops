-- User active/disabled for admin lifecycle (Access still gates login)
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_users_org_status
  ON users (organization_id, status);
