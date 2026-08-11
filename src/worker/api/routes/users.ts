import { Hono } from "hono";
import { z } from "zod";
import { USER_ROLES, normalizeRole } from "@shared/domain";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { fail, ok } from "../response";
import { appendAuditEvent } from "../../domain/audit/service";
import {
  assertUserLifecycleChange,
} from "../../auth/user-guards";
import {
  countActiveAdmins,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  normalizeUserStatus,
  updateUser,
  type UserStatus,
} from "../../db/repositories/users";
import { createId, nowIso } from "../../utils/id";

const createUserSchema = z.object({
  email: z.string().email().max(320),
  displayName: z.string().min(1).max(255).optional(),
  role: z.enum(USER_ROLES).optional(),
});

const patchUserSchema = z
  .object({
    displayName: z.string().min(1).max(255).optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.role !== undefined ||
      v.status !== undefined,
    { message: "At least one field is required" },
  );

function serializeUser(row: {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: normalizeRole(row.role),
    status: normalizeUserStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const userRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

userRoutes.get(
  "/users",
  requireAuth,
  requireRoles("admin"),
  async (c) => {
    const principal = c.get("principal")!;
    const rows = await listUsers(c.env.DOCOPS_DB, principal.organizationId);
    return ok(c, { users: rows.map(serializeUser) });
  },
);

userRoutes.post(
  "/users",
  requireAuth,
  requireRoles("admin"),
  async (c) => {
    const principal = c.get("principal")!;
    const body = await c.req.json().catch(() => null);
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Invalid request body",
        parsed.error.flatten(),
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await findUserByEmail(
      c.env.DOCOPS_DB,
      principal.organizationId,
      email,
    );
    if (existing) {
      return fail(c, 409, "USER_EXISTS", "A user with this email already exists");
    }

    const role = parsed.data.role ?? "viewer";
    const displayName =
      parsed.data.displayName?.trim() || email.split("@")[0] || email;
    const now = nowIso();
    const user = await createUser(c.env.DOCOPS_DB, {
      id: createId("usr"),
      organizationId: principal.organizationId,
      email,
      displayName,
      role,
      status: "active",
      now,
    });

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      requestId: c.get("requestId"),
      metadata: {
        email: user.email,
        role: user.role,
        preProvisioned: true,
      },
    });

    return ok(c, { user: serializeUser(user) }, 201);
  },
);

userRoutes.patch(
  "/users/:userId",
  requireAuth,
  requireRoles("admin"),
  async (c) => {
    const principal = c.get("principal")!;
    const userId = c.req.param("userId");
    const body = await c.req.json().catch(() => null);
    const parsed = patchUserSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Invalid request body",
        parsed.error.flatten(),
      );
    }

    const existing = await findUserById(c.env.DOCOPS_DB, userId);
    if (
      !existing ||
      existing.organization_id !== principal.organizationId
    ) {
      return fail(c, 404, "NOT_FOUND", "User not found");
    }

    const nextRole = parsed.data.role;
    const nextStatus = parsed.data.status as UserStatus | undefined;
    const activeAdminCount = await countActiveAdmins(
      c.env.DOCOPS_DB,
      principal.organizationId,
    );
    const guard = assertUserLifecycleChange({
      target: existing,
      nextRole,
      nextStatus,
      activeAdminCount,
      bootstrapEmails: c.env.BOOTSTRAP_ADMIN_EMAILS,
    });
    if (!guard.ok) {
      return fail(c, 409, guard.code, guard.message);
    }

    const updated = await updateUser(c.env.DOCOPS_DB, {
      id: userId,
      organizationId: principal.organizationId,
      displayName: parsed.data.displayName,
      role: nextRole,
      status: nextStatus,
      now: nowIso(),
    });
    if (!updated) {
      return fail(c, 404, "NOT_FOUND", "User not found");
    }

    const disabled =
      normalizeUserStatus(existing.status) === "active" &&
      normalizeUserStatus(updated.status) === "disabled";

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: disabled ? "user.disabled" : "user.updated",
      entityType: "user",
      entityId: updated.id,
      requestId: c.get("requestId"),
      metadata: {
        email: updated.email,
        before: {
          displayName: existing.display_name,
          role: normalizeRole(existing.role),
          status: normalizeUserStatus(existing.status),
        },
        after: {
          displayName: updated.display_name,
          role: normalizeRole(updated.role),
          status: normalizeUserStatus(updated.status),
        },
      },
    });

    return ok(c, { user: serializeUser(updated) });
  },
);

userRoutes.delete(
  "/users/:userId",
  requireAuth,
  requireRoles("admin"),
  async (c) => {
    const principal = c.get("principal")!;
    const userId = c.req.param("userId");
    const existing = await findUserById(c.env.DOCOPS_DB, userId);
    if (
      !existing ||
      existing.organization_id !== principal.organizationId
    ) {
      return fail(c, 404, "NOT_FOUND", "User not found");
    }

    if (normalizeUserStatus(existing.status) === "disabled") {
      return ok(c, { user: serializeUser(existing) });
    }

    const activeAdminCount = await countActiveAdmins(
      c.env.DOCOPS_DB,
      principal.organizationId,
    );
    const guard = assertUserLifecycleChange({
      target: existing,
      nextStatus: "disabled",
      activeAdminCount,
      bootstrapEmails: c.env.BOOTSTRAP_ADMIN_EMAILS,
    });
    if (!guard.ok) {
      return fail(c, 409, guard.code, guard.message);
    }

    const updated = await updateUser(c.env.DOCOPS_DB, {
      id: userId,
      organizationId: principal.organizationId,
      status: "disabled",
      now: nowIso(),
    });
    if (!updated) {
      return fail(c, 404, "NOT_FOUND", "User not found");
    }

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "user.disabled",
      entityType: "user",
      entityId: updated.id,
      requestId: c.get("requestId"),
      metadata: {
        email: updated.email,
        softDelete: true,
      },
    });

    return ok(c, { user: serializeUser(updated) });
  },
);
