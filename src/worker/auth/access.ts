import type { UserRole } from "@shared/domain";
import { USER_ROLES } from "@shared/domain";
import { createId, nowIso } from "../utils/id";
import { ensureDefaultOrganization } from "../db/repositories/organizations";
import type { OrganizationRow } from "../db/schema/types";
import { findUserByEmail, upsertLocalUser } from "../db/repositories/users";
import type { AppPrincipal } from "./principal";
import { logger } from "../utils/logger";

const JWKS_CACHE_TTL_SECONDS = 600;
const JWT_CLOCK_SKEW_MS = 60_000;

/** Isolate-local cache for the bootstrap org (stable per Worker isolate). */
let cachedDefaultOrg: OrganizationRow | null = null;

type JwksPayload = { keys: Array<JsonWebKey & { kid?: string }> };
type CachedJwks = { fetchedAt: number; keys: JwksPayload["keys"] };

/** Isolate-local JWKS cache; Cache API used when available. */
const jwksMemory = new Map<string, CachedJwks>();

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

/**
 * Validate Cloudflare Access JWT when configured.
 * Local development uses an explicit, clearly named bypass that is disabled outside local.
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

  let user = await findUserByEmail(env.DOCOPS_DB, org.id, identity.email);
  if (!user) {
    const bootstrap = (env.BOOTSTRAP_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role: UserRole = bootstrap.includes(identity.email.toLowerCase())
      ? "admin"
      : "viewer";
    user = await upsertLocalUser(env.DOCOPS_DB, {
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
    user = await upsertLocalUser(env.DOCOPS_DB, {
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
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input))) as T;
}

async function loadJwks(certsUrl: string): Promise<JwksPayload["keys"]> {
  const memory = jwksMemory.get(certsUrl);
  if (memory && Date.now() - memory.fetchedAt < JWKS_CACHE_TTL_SECONDS * 1000) {
    return memory.keys;
  }

  try {
    const cacheKey = new Request(certsUrl, { method: "GET" });
    const cached = await caches.default.match(cacheKey);
    if (cached?.ok) {
      const payload = (await cached.json()) as JwksPayload;
      if (Array.isArray(payload.keys)) {
        jwksMemory.set(certsUrl, {
          fetchedAt: Date.now(),
          keys: payload.keys,
        });
        return payload.keys;
      }
    }
  } catch {
    // Cache API may be unavailable in some test runtimes — fall through.
  }

  const certsResp = await fetch(certsUrl);
  if (!certsResp.ok) {
    throw new Error(`JWKS HTTP ${certsResp.status}`);
  }
  const payload = (await certsResp.json()) as JwksPayload;
  if (!Array.isArray(payload.keys)) {
    throw new Error("JWKS missing keys");
  }

  jwksMemory.set(certsUrl, { fetchedAt: Date.now(), keys: payload.keys });

  try {
    const cacheKey = new Request(certsUrl, { method: "GET" });
    await caches.default.put(
      cacheKey,
      new Response(JSON.stringify(payload), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${JWKS_CACHE_TTL_SECONDS}`,
        },
      }),
    );
  } catch {
    // Best-effort Cache API write.
  }

  return payload.keys;
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

    let keys: JwksPayload["keys"];
    try {
      keys = await loadJwks(certsUrl);
    } catch (err) {
      logger.error("access_certs_fetch_failed", {
        team,
        message: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) {
      logger.warn("access_jwt_malformed");
      return null;
    }

    const header = base64UrlToJson<{ kid?: string; alg?: string }>(headerB64);
    if (header.alg && header.alg !== "RS256") {
      logger.warn("access_jwt_alg_rejected", { alg: header.alg });
      return null;
    }

    const payloadJson = base64UrlToJson<{
      aud?: string | string[];
      iss?: string;
      email?: string;
      common_name?: string;
      name?: string;
      exp?: number;
      nbf?: number;
    }>(payloadB64);

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

    const now = Date.now();
    if (
      payloadJson.nbf &&
      payloadJson.nbf * 1000 - JWT_CLOCK_SKEW_MS > now
    ) {
      logger.warn("access_jwt_nbf");
      return null;
    }
    if (
      payloadJson.exp &&
      payloadJson.exp * 1000 + JWT_CLOCK_SKEW_MS < now
    ) {
      logger.warn("access_jwt_expired");
      return null;
    }

    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      logger.warn("access_jwk_kid_missing", { kid: header.kid });
      return null;
    }

    const key = await crypto.subtle.importKey(
      "jwk",
      {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        alg: "RS256",
      },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToBytes(signatureB64);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      data,
    );
    if (!valid) {
      logger.warn("access_jwt_signature_invalid");
      return null;
    }

    const email = payloadJson.email || payloadJson.common_name;
    if (!email) {
      logger.warn("access_jwt_email_missing");
      return null;
    }
    return { email, name: payloadJson.name };
  } catch (err) {
    logger.error("access_jwt_verify_failed", {
      errorCode: "ACCESS_JWT_INVALID",
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
