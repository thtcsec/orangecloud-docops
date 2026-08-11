import { first, type Db } from "./base";

export async function getOrgSetting(
  db: Db,
  organizationId: string,
  key: string,
): Promise<string | null> {
  const row = await first<{ value: string }>(
    db
      .prepare(
        `SELECT value FROM organization_settings
         WHERE organization_id = ? AND key = ? LIMIT 1`,
      )
      .bind(organizationId, key),
  );
  return row?.value ?? null;
}

export async function putOrgSetting(
  db: Db,
  organizationId: string,
  key: string,
  value: string,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO organization_settings (organization_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(organization_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .bind(organizationId, key, value, now)
    .run();
}

export async function deleteOrgSetting(
  db: Db,
  organizationId: string,
  key: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM organization_settings WHERE organization_id = ? AND key = ?`,
    )
    .bind(organizationId, key)
    .run();
}
