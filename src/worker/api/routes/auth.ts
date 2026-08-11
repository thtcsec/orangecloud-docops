import { Hono } from "hono";
import { z } from "zod";
import { normalizeRole } from "@shared/domain";
import type { AppVariables } from "../middleware/context";
import { fail, ok } from "../response";
import { hashPassword, verifyPassword } from "../../auth/password";
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  createSessionToken,
} from "../../auth/session";
import { resolvePrincipal } from "../../auth/access";
import type { UserRow } from "../../db/schema/types";
import {
  countTotalUsers,
  createUserWithPassword,
  findUserByEmail,
  findUserById,
  normalizeUserStatus,
  updateUserPassword,
} from "../../db/repositories/users";

import { ensureDefaultOrganization } from "../../db/repositories/organizations";
import { appendAuditEvent } from "../../domain/audit/service";
import { createId, nowIso } from "../../utils/id";

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  displayName: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export const authRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

/**
 * POST /api/auth/register
 * Direct self-registration for new users with Email & Password.
 */
authRoutes.post("/register", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Invalid registration payload",
    );
  }

  const { email, password, displayName } = parsed.data;
  const now = nowIso();

  // Resolve default organization
  const org = await ensureDefaultOrganization(c.env.DOCOPS_DB, {
    id: createId("org"),
    name: "OrangeCloud Demo Org",
    slug: "orangecloud-demo",
    now,
  });

  const existing = await findUserByEmail(c.env.DOCOPS_DB, org.id, email);
  if (existing && existing.password_hash) {
    return fail(
      c,
      409,
      "EMAIL_ALREADY_EXISTS",
      "An account with this email already exists. Please log in instead.",
    );
  }

  const passwordHash = await hashPassword(password);
  let user: UserRow;

  if (existing && !existing.password_hash) {
    // User already exists via Cloudflare Access without password; set their password now.
    await updateUserPassword(c.env.DOCOPS_DB, existing.id, org.id, passwordHash, now);
    const updated = await findUserById(c.env.DOCOPS_DB, existing.id);
    user = updated || existing;
  } else {
    // Determine initial role: First user or bootstrap admin is 'admin', subsequent users are 'viewer'
    const totalUsers = await countTotalUsers(c.env.DOCOPS_DB, org.id);
    const bootstrapEmails = (c.env.BOOTSTRAP_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const shouldBeAdmin =
      totalUsers === 0 || bootstrapEmails.includes(email.toLowerCase());
    const initialRole = shouldBeAdmin ? "admin" : "viewer";

    user = await createUserWithPassword(c.env.DOCOPS_DB, {
      id: createId("usr"),
      organizationId: org.id,
      email: email.toLowerCase(),
      displayName,
      passwordHash,
      role: initialRole,
      status: "active",
      now,
    });
  }


  await appendAuditEvent(c.env.DOCOPS_DB, {
    organizationId: org.id,
    actorType: "user",
    actorId: user.id,
    action: "user.registered",
    entityType: "user",
    entityId: user.id,
    metadata: {
      email: user.email,
      role: user.role,
      authSource: "direct_session",
    },
  });

  const sessionToken = await createSessionToken(
    {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      displayName: user.display_name,
      role: normalizeRole(user.role),
    },
    c.env,
  );

  c.header("Set-Cookie", buildSessionCookieHeader(sessionToken, c.env));

  return ok(
    c,
    {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: normalizeRole(user.role),
        status: normalizeUserStatus(user.status),
      },
      sessionToken,
    },
    201,
  );
});

/**
 * POST /api/auth/login
 * Direct email & password sign-in.
 */
authRoutes.post("/login", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return fail(c, 400, "VALIDATION_ERROR", "Email and password are required");
  }

  const { email, password } = parsed.data;
  const now = nowIso();

  const org = await ensureDefaultOrganization(c.env.DOCOPS_DB, {
    id: createId("org"),
    name: "OrangeCloud Demo Org",
    slug: "orangecloud-demo",
    now,
  });

  const user = await findUserByEmail(c.env.DOCOPS_DB, org.id, email);
  if (!user || !user.password_hash) {
    return fail(
      c,
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password. Please check your credentials.",
    );
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return fail(
      c,
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password. Please check your credentials.",
    );
  }

  if (normalizeUserStatus(user.status) === "disabled") {
    return fail(
      c,
      403,
      "ACCOUNT_SUSPENDED",
      "Your account has been deactivated. Please contact your system administrator.",
    );
  }

  await appendAuditEvent(c.env.DOCOPS_DB, {
    organizationId: org.id,
    actorType: "user",
    actorId: user.id,
    action: "user.logged_in",
    entityType: "user",
    entityId: user.id,
    metadata: {
      email: user.email,
      role: user.role,
      authSource: "direct_session",
    },
  });

  const sessionToken = await createSessionToken(
    {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      displayName: user.display_name,
      role: normalizeRole(user.role),
    },
    c.env,
  );

  c.header("Set-Cookie", buildSessionCookieHeader(sessionToken, c.env));

  return ok(c, {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: normalizeRole(user.role),
      status: normalizeUserStatus(user.status),
    },
    sessionToken,
  });
});

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
authRoutes.post("/logout", async (c) => {
  const principal = await resolvePrincipal(c.req.raw, c.env);
  if (principal) {
    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "user.logged_out",
      entityType: "user",
      entityId: principal.userId,
      metadata: {
        email: principal.email,
      },
    });
  }


  c.header("Set-Cookie", buildClearSessionCookieHeader(c.env));
  return ok(c, { success: true });
});

/**
 * GET /api/auth/me
 * Returns current authenticated state and user info.
 */
authRoutes.get("/me", async (c) => {
  const principal = await resolvePrincipal(c.req.raw, c.env);
  if (!principal) {
    return ok(c, {
      authenticated: false,
      user: null,
    });
  }

  return ok(c, {
    authenticated: true,
    user: {
      id: principal.userId,
      organizationId: principal.organizationId,
      email: principal.email,
      displayName: principal.displayName,
      role: principal.role,
      authSource: principal.authSource,
    },
  });
});
