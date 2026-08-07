import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { ok } from "../response";

export const healthRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

healthRoutes.get("/health", (c) => {
  const accessConfigured = Boolean(
    c.env.CF_ACCESS_AUD && c.env.CF_ACCESS_TEAM_DOMAIN,
  );
  const localAuth =
    c.env.ENVIRONMENT === "local" && c.env.LOCAL_DEV_AUTH_ENABLED === "true";

  return ok(c, {
    status: "ok",
    service: "orangecloud-docops",
    environment: c.env.ENVIRONMENT,
    time: new Date().toISOString(),
    readiness: {
      d1: Boolean(c.env.DOCOPS_DB),
      r2: Boolean(c.env.DOCUMENTS_BUCKET),
      queue: Boolean(c.env.PROCESSING_QUEUE),
      workflow: Boolean(c.env.DOCUMENT_WORKFLOW),
      accessConfigured: localAuth || accessConfigured,
      localDevAuth: localAuth,
      uploadRateLimiter: Boolean(c.env.UPLOAD_RATE_LIMITER),
      apiRateLimiter: Boolean(c.env.API_RATE_LIMITER),
    },
  });
});
