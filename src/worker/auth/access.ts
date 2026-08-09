import type { UserRole } from "@shared/domain";
import { USER_ROLES } from "@shared/domain";
import { createId, nowIso } from "../utils/id";
import { ensureDefaultOrganization } from "../db/repositories/organizations";
import { findUserByEmail, upsertLocalUser } from "../db/repositories/users";
import type { AppPrincipal } from "./principal";
import { logger } from "../utils/logger";

function isLocalAuthEnabled(env: Env): boolean {
  return (
    env.ENVIRONMENT === "local" &&
    env.LOCAL_DEV_AUTH_ENABLED === "true"
  );
}

function parseRole(value: string | undefined): UserRole {
  if (value && (USER_ROLES as readonly string[]).includes(value)) {
    return value as UserRole;
  }
  return "viewer";
}

/**
 * Validate Cloudflare Access JWT when configured.
 * Local development uses an explicit, clearly named bypass that is disabled outside local.
 */
export async function resolvePrincipal(
  request: Request,
  env: Env,
): Promise<AppPrincipal | null> {
  const db = env.DOCOPS_DB;
  const now = nowIso();
  const org = await ensureDefaultOrganization(db, {
    id: createId("org"),
    name: "OrangeCloud Demo Org",
    slug: "orangecloud-demo",
    now,
  });

  if (isLocalAuthEnabled(env)) {
    const email =
      env.LOCAL_DEV_AUTH_EMAIL?.trim() ||
      request.headers.get("x-docops-dev-email")?.trim();
    if (!email) {
      logger.warn("local_dev_auth_enabled_but_no_email");
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
    const user = await upsertLocalUser(db, {
      id: createId("usr"),
      organizationId: org.id,
      email,
      displayName,
      role,
      now,
    });
    return {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      authSource: "local_dev",
    };
  }

  // Production/staging: trust Cloudflare Access JWT after signature validation.
  // Edge injects Cf-Access-Jwt-Assertion when Access protects the hostname;
  // browsers also hold CF_Authorization cookie on the app domain.
  const jwt =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers.get("cf-access-jwt-assertion") ||
    readCookie(request, "CF_Authorization");

  if (!jwt) {
    logger.warn("access_jwt_missing", {
      environment: env.ENVIRONMENT,
      hasAccessHeader: Boolean(
        request.headers.get("Cf-Access-Jwt-Assertion") ||
          request.headers.get("cf-access-jwt-assertion"),
      ),
      hasAuthCookie: Boolean(readCookie(request, "CF_Authorization")),
    });
    return null;
  }

  if (!env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) {
    logger.error("access_not_configured", {
      environment: env.ENVIRONMENT,
      message:
        "CF_ACCESS_AUD / CF_ACCESS_TEAM_DOMAIN secrets missing — refusing auth",
    });
    return null;
  }

  const identity = await verifyAccessJwt(jwt, env);
  if (!identity?.email) {
    return null;
  }

  let user = await findUserByEmail(db, org.id, identity.email);
  if (!user) {
    const bootstrap = (env.BOOTSTRAP_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role: UserRole = bootstrap.includes(identity.email.toLowerCase())
      ? "admin"
      : "viewer";
    user = await upsertLocalUser(db, {
      id: createId("usr"),
      organizationId: org.id,
      email: identity.email,
      displayName: identity.name || identity.email,
      role,
      now,
    });
  } else if (
    user.role === "viewer" &&
    (env.BOOTSTRAP_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(identity.email.toLowerCase())
  ) {
    // Elevate pre-seeded / first-login viewer listed as bootstrap admin.
    user = await upsertLocalUser(db, {
      id: user.id,
      organizationId: org.id,
      email: user.email,
      displayName: user.display_name,
      role: "admin",
      now,
    });
  }

  return {
    userId: user.id,
    organizationId: org.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    authSource: "cloudflare_access",
  };
}

type AccessIdentity = { email: string; name?: string };

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const value = rest.join("=").trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

async function verifyAccessJwt(
  token: string,
  env: Env,
): Promise<AccessIdentity | null> {
  try {
    const team = env.CF_ACCESS_TEAM_DOMAIN!.replace(/^https?:\/\//, "").replace(
      /\.cloudflareaccess\.com$/i,
      "",
    );
    const aud = env.CF_ACCESS_AUD!;
    const issuer = `https://${team}.cloudflareaccess.com`;
    const certsUrl = `${issuer}/cdn-cgi/access/certs`;
    const certsResp = await fetch(certsUrl);
    if (!certsResp.ok) {
      logger.error("access_certs_fetch_failed", {
        status: certsResp.status,
        team,
      });
      return null;
    }
    const certs = (await certsResp.json()) as {
      keys: JsonWebKey[];
    };

    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payloadJson = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as {
      aud?: string | string[];
      iss?: string;
      email?: string;
      common_name?: string;
      name?: string;
      exp?: number;
    };

    const audOk = Array.isArray(payloadJson.aud)
      ? payloadJson.aud.includes(aud)
      : payloadJson.aud === aud;
    if (!audOk) {
      logger.warn("access_aud_mismatch", {
        expected: aud,
        actual: payloadJson.aud,
      });
      return null;
    }
    if (payloadJson.iss && payloadJson.iss !== issuer) {
      logger.warn("access_iss_mismatch", {
        expected: issuer,
        actual: payloadJson.iss,
      });
      return null;
    }
    if (payloadJson.exp && payloadJson.exp * 1000 < Date.now()) return null;

    // Validate signature against published JWKS.
    const header = JSON.parse(
      atob(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { kid?: string; alg?: string };
    const jwk = certs.keys.find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const data = new TextEncoder().encode(`${h}.${p}`);
    const signature = Uint8Array.from(
      atob(s.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      data,
    );
    if (!valid) return null;

    const email = payloadJson.email || payloadJson.common_name;
    if (!email) return null;
    return { email, name: payloadJson.name };
  } catch (err) {
    logger.error("access_jwt_verify_failed", {
      errorCode: "ACCESS_JWT_INVALID",
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
