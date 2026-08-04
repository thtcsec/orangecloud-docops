import { createMiddleware } from "hono/factory";
import { createRequestId } from "../../utils/id";
import type { AppPrincipal } from "../../auth/principal";

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
  await next();
});
