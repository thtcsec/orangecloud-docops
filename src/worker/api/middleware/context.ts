import { createMiddleware } from "hono/factory";
import { createRequestId } from "../../utils/id";
import type { AppPrincipal } from "../../auth/principal";
import { logger } from "../../utils/logger";

export type AppVariables = {
  requestId: string;
  principal: AppPrincipal | null;
};

export const requestContext = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const requestId =
    c.req.header("x-request-id")?.trim() || createRequestId();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  const started = Date.now();
  await next();
  const durationMs = Date.now() - started;
  c.header("x-response-time", `${durationMs}ms`);
  logger.info("request_completed", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs,
  });
});
