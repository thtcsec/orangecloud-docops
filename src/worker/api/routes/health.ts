import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { ok } from "../response";

export const healthRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

healthRoutes.get("/health", async (c) => {
  const accessConfigured = Boolean(
    c.env.CF_ACCESS_AUD && c.env.CF_ACCESS_TEAM_DOMAIN,
  );
  const localAuth =
    c.env.ENVIRONMENT === "local" && c.env.LOCAL_DEV_AUTH_ENABLED === "true";

  let d1Ok = Boolean(c.env.DOCOPS_DB);
  if (c.env.DOCOPS_DB) {
    try {
      await c.env.DOCOPS_DB.prepare("SELECT 1 AS ok").first();
      d1Ok = true;
    } catch {
      d1Ok = false;
    }
  }

  const ready = d1Ok && Boolean(c.env.DOCUMENTS_BUCKET) && Boolean(c.env.PROCESSING_QUEUE);

  return ok(
    c,
    {
      status: ready ? "ok" : "degraded",
      service: "orangecloud-docops",
      environment: c.env.ENVIRONMENT,
      time: new Date().toISOString(),
      readiness: {
        d1: d1Ok,
        r2: Boolean(c.env.DOCUMENTS_BUCKET),
        queue: Boolean(c.env.PROCESSING_QUEUE),
        workflow: Boolean(c.env.DOCUMENT_WORKFLOW),
        accessConfigured: localAuth || accessConfigured,
        localDevAuth: localAuth,
        uploadRateLimiter: Boolean(c.env.UPLOAD_RATE_LIMITER),
        apiRateLimiter: Boolean(c.env.API_RATE_LIMITER),
      },
    },
    ready ? 200 : 503,
  );
});
