import { Hono } from "hono";
import { PLANNED_INTEGRATIONS } from "@shared/domain";
import type { AppVariables } from "../middleware/context";
import { requireAuth } from "../middleware/auth";
import { ok } from "../response";

export const integrationRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

integrationRoutes.get("/integrations", requireAuth, (c) => {
  return ok(c, {
    integrations: PLANNED_INTEGRATIONS.map((item) => ({
      ...item,
      connected: false,
      configurable: false,
    })),
  });
});
