import type { UserRole } from "@shared/domain";
import type { UserRow } from "../schema/types";
import { all, first, type Db } from "./base";

export async function findUserByEmail(
  db: Db,
  organizationId: string,
  email: string,
): Promise<UserRow | null> {
  return first<UserRow>(
    db
      .prepare(
        `SELECT * FROM users WHERE organization_id = ? AND lower(email) = lower(?) LIMIT 1`,
      )
      .bind(organizationId, email),
  );
}

export async function findUserById(
  db: Db,
  id: string,
): Promise<UserRow | null> {
  return first<UserRow>(
    db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).bind(id),
  );
}

export async function upsertLocalUser(
  db: Db,
  input: {
    id: string;
    organizationId: string;
    email: string;
    displayName: string;
    role: UserRole;
    now: string;
  },
): Promise<UserRow> {
  await db
    .prepare(
      `INSERT INTO users (id, organization_id, email, display_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id, email) DO UPDATE SET
         display_name = excluded.display_name,
         role = excluded.role,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.organizationId,
      input.email.toLowerCase(),
      input.displayName,
      input.role,
      input.now,
      input.now,
    )
    .run();

  const user = await findUserByEmail(db, input.organizationId, input.email);
  if (!user) throw new Error("Failed to upsert local user");
  return user;
}

export async function listUsers(db: Db, organizationId: string) {
  return all<UserRow>(
    db
      .prepare(`SELECT * FROM users WHERE organization_id = ? ORDER BY email`)
      .bind(organizationId),
  );
}
