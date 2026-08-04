import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { ok } from "../response";

export const healthRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

healthRoutes.get("/health", (c) => {
  return ok(c, {
    status: "ok",
    service: "orangecloud-docops",
    environment: c.env.ENVIRONMENT,
    time: new Date().toISOString(),
  });
});
