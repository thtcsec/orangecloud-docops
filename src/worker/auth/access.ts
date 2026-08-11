import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import type { UserRole } from "@shared/domain";
import { normalizeRole } from "@shared/domain";
import { createId, nowIso } from "../utils/id";
import { ensureDefaultOrganization } from "../db/repositories/organizations";
import type { OrganizationRow } from "../db/schema/types";
import { findUserByEmail, normalizeUserStatus, upsertLocalUser } from "../db/repositories/users";
import type { AppPrincipal } from "./principal";
import { logger } from "../utils/logger";

/** Isolate-local cache for the bootstrap org (stable per Worker isolate). */
let cachedDefaultOrg: OrganizationRow | null = null;

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type AccessAuthFailureReason =
  | "jwt_missing"
  | "secrets_missing"
  | "aud_mismatch"
  | "iss_mismatch"
  | "signature_invalid"
  | "email_missing"
  | "verify_failed";

export type AccessAuthFailure = {
  reason: AccessAuthFailureReason;
  hasJwtHeader: boolean;
  hasJwtCookie: boolean;
  /** First 8 chars of configured AUD — safe to show in UI. */
  configuredAudPrefix?: string;
  /** First 8 chars of token aud claim. */
  tokenAudPrefix?: string;
  configuredIss?: string;
  tokenIss?: string;
  message?: string;
};

type AccessIdentity = { email: string; name?: string };

function isLocalAuthEnabled(env: Env): boolean {
  return (
    env.ENVIRONMENT === "local" && env.LOCAL_DEV_AUTH_ENABLED === "true"
  );
}

function parseRole(value: string | undefined): UserRole {
  return normalizeRole(value);
}

async function getDefaultOrg(env: Env, now: string): Promise<OrganizationRow> {
  if (cachedDefaultOrg) return cachedDefaultOrg;
  cachedDefaultOrg = await ensureDefaultOrganization(env.DOCOPS_DB, {
    id: createId("org"),
    name: "OrangeCloud Demo Org",
    slug: "orangecloud-demo",
    now,
  });
  return cachedDefaultOrg;
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const value = rest.join("=").trim();
      if (!value) return null;
      // Only decode when percent-encoded — blind decodeURIComponent can corrupt JWTs.
      if (!value.includes("%")) return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

function prefix8(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 8);
}

function normalizeTeamIssuer(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/cdn-cgi\/access\/certs$/i, "");
  }
  const team = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/\.cloudflareaccess\.com$/i, "");
  return `https://${team}.cloudflareaccess.com`;
}

function getAccessJwt(request: Request): {
  jwt: string | null;
  hasJwtHeader: boolean;
  hasJwtCookie: boolean;
} {
  const header =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers.get("cf-access-jwt-assertion");
  const cookie = readCookie(request, "CF_Authorization");
  return {
    jwt: header || cookie,
    hasJwtHeader: Boolean(header),
    hasJwtCookie: Boolean(cookie),
  };
}

function peekTokenClaims(jwt: string): {
  aud?: string | string[];
  iss?: string;
  email?: string;
  common_name?: string;
  name?: string;
} {
  try {
    return decodeJwt(jwt);
  } catch {
    return {};
  }
}

function audValues(aud: string | string[] | undefined): string[] {
  if (!aud) return [];
  return Array.isArray(aud) ? aud : [aud];
}

/**
 * Validate Cloudflare Access JWT (header preferred, cookie fallback).
 * Returns a typed failure so /api/auth/start can show the real misconfig.
 */
export async function authenticateAccessRequest(
  request: Request,
  env: Env,
): Promise<
  | { ok: true; identity: AccessIdentity }
  | { ok: false; failure: AccessAuthFailure }
> {
  const { jwt, hasJwtHeader, hasJwtCookie } = getAccessJwt(request);
  if (!jwt) {
    logger.warn("access_jwt_missing", {
      environment: env.ENVIRONMENT,
      hasJwtHeader,
      hasJwtCookie,
    });
    return {
      ok: false,
      failure: { reason: "jwt_missing", hasJwtHeader, hasJwtCookie },
    };
  }

  if (!env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) {
    logger.error("access_not_configured", { environment: env.ENVIRONMENT });
    return {
      ok: false,
      failure: {
        reason: "secrets_missing",
        hasJwtHeader,
        hasJwtCookie,
        message: "CF_ACCESS_AUD / CF_ACCESS_TEAM_DOMAIN missing on Worker",
      },
    };
  }

  const aud = env.CF_ACCESS_AUD.trim();
  const issuer = normalizeTeamIssuer(env.CF_ACCESS_TEAM_DOMAIN);
  const claims = peekTokenClaims(jwt);
  const tokenAudList = audValues(claims.aud);

  if (tokenAudList.length > 0 && !tokenAudList.includes(aud)) {
    logger.warn("access_aud_mismatch", {
      expectedPrefix: prefix8(aud),
      actualPrefix: tokenAudList.map(prefix8),
    });
    return {
      ok: false,
      failure: {
        reason: "aud_mismatch",
        hasJwtHeader,
        hasJwtCookie,
        configuredAudPrefix: prefix8(aud),
        tokenAudPrefix: prefix8(tokenAudList[0]),
        configuredIss: issuer,
        tokenIss: claims.iss,
        message:
          "Worker CF_ACCESS_AUD does not match the JWT aud claim. Copy Application Audience (AUD) Tag from Zero Trust → Access → Applications → this app.",
      },
    };
  }

  try {
    let jwks = jwksByIssuer.get(issuer);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
      jwksByIssuer.set(issuer, jwks);
    }

    const { payload } = await jwtVerify(jwt, jwks, {
      issuer,
      audience: aud,
    });

    const email =
      (typeof payload.email === "string" && payload.email) ||
      (typeof payload.common_name === "string" && payload.common_name) ||
      undefined;
    if (!email) {
      logger.warn("access_jwt_email_missing");
      return {
        ok: false,
        failure: {
          reason: "email_missing",
          hasJwtHeader,
          hasJwtCookie,
          message:
            "JWT verified but has no email/common_name claim (IdP must release email).",
        },
      };
    }

    return {
      ok: true,
      identity: {
        email,
        name: typeof payload.name === "string" ? payload.name : undefined,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const lower = message.toLowerCase();
    let reason: AccessAuthFailureReason = "verify_failed";
    if (lower.includes("aud")) reason = "aud_mismatch";
    else if (lower.includes("iss")) reason = "iss_mismatch";
    else if (lower.includes("signature") || lower.includes("jwks")) {
      reason = "signature_invalid";
    }

    logger.error("access_jwt_verify_failed", {
      errorCode: "ACCESS_JWT_INVALID",
      reason,
      message,
      hasJwtHeader,
      hasJwtCookie,
    });

    return {
      ok: false,
      failure: {
        reason,
        hasJwtHeader,
        hasJwtCookie,
        configuredAudPrefix: prefix8(aud),
        tokenAudPrefix: prefix8(tokenAudList[0]),
        configuredIss: issuer,
        tokenIss: claims.iss,
        message,
      },
    };
  }
}

/**
 * Resolve the signed-in principal for API requests.
 */
export async function resolvePrincipal(
  request: Request,
  env: Env,
): Promise<AppPrincipal | null> {
  const now = nowIso();
  const org = await getDefaultOrg(env, now);

  if (isLocalAuthEnabled(env)) {
    const email =
      env.LOCAL_DEV_AUTH_EMAIL?.trim() ||
      request.headers.get("x-docops-dev-email")?.trim();
    if (!email) {
      logger.warn("local_dev_auth_enabled_but_no_email");
      return null;
    }
    const existing = await findUserByEmail(env.DOCOPS_DB, org.id, email);
    if (existing && normalizeUserStatus(existing.status) === "disabled") {
      logger.warn("local_user_disabled", { email: existing.email });
      return null;
    }
    const role = parseRole(
      env.LOCAL_DEV_AUTH_ROLE ||
        request.headers.get("x-docops-dev-role") ||
        undefined,
    );
    const displayName =
      env.LOCAL_DEV_AUTH_DISPLAY_NAME ||
      request.headers.get("x-docops-dev-name") ||
      email;
    const user = await upsertLocalUser(env.DOCOPS_DB, {
      id: existing?.id || createId("usr"),
      organizationId: org.id,
      email,
      displayName,
      role,
      now,
      status: "active",
    });
    return {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      displayName: user.display_name,
      role: normalizeRole(user.role),
      authSource: "local_dev",
    };
  }

  const auth = await authenticateAccessRequest(request, env);
  if (!auth.ok) return null;

  const identity = auth.identity;
  const bootstrap = (env.BOOTSTRAP_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emailKey = identity.email.toLowerCase();
  const shouldBeAdmin = bootstrap.includes(emailKey);

  let user = await findUserByEmail(env.DOCOPS_DB, org.id, identity.email);
  if (!user) {
    user = await upsertLocalUser(env.DOCOPS_DB, {
      id: createId("usr"),
      organizationId: org.id,
      email: identity.email,
      displayName: identity.name || identity.email,
      role: shouldBeAdmin ? "admin" : "viewer",
      now,
      status: "active",
    });
  } else if (shouldBeAdmin) {
    // Always re-assert bootstrap admins (fixes stale viewer / disabled rows).
    user = await upsertLocalUser(env.DOCOPS_DB, {
      id: user.id,
      organizationId: org.id,
      email: user.email,
      displayName: identity.name || user.display_name,
      role: "admin",
      now,
      status: "active",
    });
  } else {
    // Keep admin-assigned role/status; only normalize casing.
    user = {
      ...user,
      role: normalizeRole(user.role),
      status: normalizeUserStatus(user.status),
    };
  }

  if (normalizeUserStatus(user.status) === "disabled") {
    logger.warn("access_user_disabled", { email: user.email });
    return null;
  }

  return {
    userId: user.id,
    organizationId: org.id,
    email: user.email,
    displayName: user.display_name,
    role: normalizeRole(user.role),
    authSource: "cloudflare_access",
  };
}
