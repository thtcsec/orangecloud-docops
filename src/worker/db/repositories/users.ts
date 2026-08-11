import type { UserRole } from "@shared/domain";
import type { UserRow } from "../schema/types";
import { all, first, type Db } from "./base";

export type UserStatus = "active" | "disabled";

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
    status?: UserStatus;
  },
): Promise<UserRow> {
  const status = input.status ?? "active";
  await db
    .prepare(
      `INSERT INTO users (id, organization_id, email, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id, email) DO UPDATE SET
         display_name = excluded.display_name,
         role = excluded.role,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.organizationId,
      input.email.toLowerCase(),
      input.displayName,
      input.role,
      status,
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
      .prepare(
        `SELECT * FROM users WHERE organization_id = ? ORDER BY email COLLATE NOCASE`,
      )
      .bind(organizationId),
  );
}

export async function countActiveAdmins(
  db: Db,
  organizationId: string,
): Promise<number> {
  const row = await first<{ n: number }>(
    db
      .prepare(
        `SELECT COUNT(*) as n FROM users
         WHERE organization_id = ? AND role = 'admin' AND status = 'active'`,
      )
      .bind(organizationId),
  );
  return row?.n ?? 0;
}

export async function createUser(
  db: Db,
  input: {
    id: string;
    organizationId: string;
    email: string;
    displayName: string;
    role: UserRole;
    status?: UserStatus;
    now: string;
  },
): Promise<UserRow> {
  const status = input.status ?? "active";
  await db
    .prepare(
      `INSERT INTO users (id, organization_id, email, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.organizationId,
      input.email.toLowerCase(),
      input.displayName,
      input.role,
      status,
      input.now,
      input.now,
    )
    .run();
  const user = await findUserById(db, input.id);
  if (!user) throw new Error("Failed to create user");
  return user;
}

export async function updateUser(
  db: Db,
  input: {
    id: string;
    organizationId: string;
    displayName?: string;
    role?: UserRole;
    status?: UserStatus;
    now: string;
  },
): Promise<UserRow | null> {
  const existing = await findUserById(db, input.id);
  if (!existing || existing.organization_id !== input.organizationId) {
    return null;
  }
  const displayName = input.displayName ?? existing.display_name;
  const role = input.role ?? existing.role;
  const status = input.status ?? normalizeUserStatus(existing.status);
  await db
    .prepare(
      `UPDATE users SET display_name = ?, role = ?, status = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
    )
    .bind(displayName, role, status, input.now, input.id, input.organizationId)
    .run();
  return findUserById(db, input.id);
}

export function normalizeUserStatus(value: unknown): UserStatus {
  return value === "disabled" ? "disabled" : "active";
}
