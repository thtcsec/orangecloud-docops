import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { requireAuth } from "../middleware/auth";
import { ok } from "../response";

export const sessionRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

sessionRoutes.get("/session", requireAuth, (c) => {
  const principal = c.get("principal")!;
  return ok(c, {
    user: {
      id: principal.userId,
      email: principal.email,
      displayName: principal.displayName,
      role: principal.role,
      organizationId: principal.organizationId,
      authSource: principal.authSource,
    },
  });
});
