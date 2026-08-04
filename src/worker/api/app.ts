import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestContext, type AppVariables } from "./middleware/context";
import { healthRoutes } from "./routes/health";
import { sessionRoutes } from "./routes/session";
import { dashboardRoutes } from "./routes/dashboard";
import { documentRoutes } from "./routes/documents";
import { caseRoutes } from "./routes/cases";
import { reviewRoutes } from "./routes/reviews";
import { ruleRoutes } from "./routes/rules";
import { auditRoutes } from "./routes/audit";
import { integrationRoutes } from "./routes/integrations";
import { fail } from "./response";
import { logger } from "../utils/logger";

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

  app.use("*", requestContext);
  app.use(
    "/api/*",
    cors({
      origin: (origin) => origin,
      credentials: true,
    }),
  );

  const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  api.route("/", healthRoutes);
  api.route("/", sessionRoutes);
  api.route("/", dashboardRoutes);
  api.route("/", documentRoutes);
  api.route("/", caseRoutes);
  api.route("/", reviewRoutes);
  api.route("/", ruleRoutes);
  api.route("/", auditRoutes);
  api.route("/", integrationRoutes);

  api.notFound((c) => fail(c, 404, "NOT_FOUND", "API route not found"));
  api.onError((err, c) => {
    logger.error("api_unhandled_error", {
      requestId: c.get("requestId"),
      errorCode: "INTERNAL_ERROR",
      messageText: err.message,
    });
    return fail(c, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  });

  app.route("/api", api);
  return app;
}
