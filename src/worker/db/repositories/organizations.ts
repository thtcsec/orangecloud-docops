import type { OrganizationRow } from "../schema/types";
import { first, type Db } from "./base";

export async function getDefaultOrganization(
  db: Db,
): Promise<OrganizationRow | null> {
  return first<OrganizationRow>(
    db.prepare(`SELECT * FROM organizations ORDER BY created_at LIMIT 1`),
  );
}

export async function getOrganizationBySlug(
  db: Db,
  slug: string,
): Promise<OrganizationRow | null> {
  return first<OrganizationRow>(
    db.prepare(`SELECT * FROM organizations WHERE slug = ? LIMIT 1`).bind(slug),
  );
}

export async function ensureDefaultOrganization(
  db: Db,
  input: { id: string; name: string; slug: string; now: string },
): Promise<OrganizationRow> {
  const existing = await getOrganizationBySlug(db, input.slug);
  if (existing) return existing;

  await db
    .prepare(
      `INSERT INTO organizations (id, name, slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.id, input.name, input.slug, input.now, input.now)
    .run();

  const org = await getOrganizationBySlug(db, input.slug);
  if (!org) throw new Error("Failed to create default organization");
  return org;
}
