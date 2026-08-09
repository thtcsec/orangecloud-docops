import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { resolvePrincipal } from "../../auth/access";
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
  const principal = await resolvePrincipal(c.req.raw, c.env);
  if (!principal) {
    return fail(
      c,
      401,
      "UNAUTHORIZED",
      "Access signed you in at the edge, but the Worker could not verify the JWT. Check CF_ACCESS_AUD / CF_ACCESS_TEAM_DOMAIN secrets match this Access application.",
    );
  }
  return c.redirect(next, 302);
});
