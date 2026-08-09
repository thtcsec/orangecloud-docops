import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import {
  authenticateAccessRequest,
  resolvePrincipal,
} from "../../auth/access";
import { fail } from "../response";

/**
 * Access kickoff: hit an Access-protected /api path so Cloudflare sets
 * CF_Authorization, then bounce into the SPA. Needed when /app* is not
 * (or not yet) an Access destination — soft-nav from the public landing
 * otherwise never receives a JWT.
 */
export const authStartRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

function safeAppNext(raw: string | undefined): string {
  const fallback = "/app/dashboard";
  if (!raw) return fallback;
  // Relative same-origin paths under /app only (open-redirect guard).
  if (!raw.startsWith("/app") || raw.startsWith("//") || raw.includes("://")) {
    return fallback;
  }
  if (raw.includes("\\") || raw.includes("@")) return fallback;
  return raw;
}

authStartRoutes.get("/auth/start", async (c) => {
  const next = safeAppNext(c.req.query("next") ?? undefined);

  // Local/dev: resolvePrincipal already handles bypass.
  if (
    c.env.ENVIRONMENT === "local" &&
    c.env.LOCAL_DEV_AUTH_ENABLED === "true"
  ) {
    const principal = await resolvePrincipal(c.req.raw, c.env);
    if (!principal) {
      return fail(c, 401, "UNAUTHORIZED", "Local auth could not resolve a user");
    }
    return c.redirect(next, 302);
  }

  const auth = await authenticateAccessRequest(c.req.raw, c.env);
  if (!auth.ok) {
    const { failure } = auth;
    const messages: Record<string, string> = {
      jwt_missing:
        "Access edge let the request through, but no Cf-Access-Jwt-Assertion header and no CF_Authorization cookie reached the Worker.",
      secrets_missing:
        "Worker secrets CF_ACCESS_AUD / CF_ACCESS_TEAM_DOMAIN are missing.",
      aud_mismatch:
        "CF_ACCESS_AUD on the Worker does not match this Access application's AUD Tag (token aud ≠ secret).",
      iss_mismatch:
        "CF_ACCESS_TEAM_DOMAIN does not match the JWT issuer (expected https://<team>.cloudflareaccess.com).",
      signature_invalid:
        "JWT signature/JWKS verification failed (wrong team domain or stale keys).",
      email_missing:
        "JWT is valid but has no email claim — IdP must release email.",
      verify_failed: "Access JWT verification failed.",
    };
    return fail(
      c,
      401,
      "UNAUTHORIZED",
      messages[failure.reason] || messages.verify_failed,
      failure,
    );
  }

  // Materialize/upsert the user row, then bounce into the SPA.
  const principal = await resolvePrincipal(c.req.raw, c.env);
  if (!principal) {
    return fail(
      c,
      401,
      "UNAUTHORIZED",
      "JWT verified but user provisioning failed",
    );
  }
  return c.redirect(next, 302);
});
