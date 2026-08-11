import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestContext, type AppVariables } from "./middleware/context";
import { securityHeaders } from "./middleware/security-headers";
import { apiRateLimit } from "./middleware/rate-limit";
import { healthRoutes } from "./routes/health";
import { authStartRoutes } from "./routes/auth-start";
import { sessionRoutes } from "./routes/session";
import { dashboardRoutes } from "./routes/dashboard";
import { documentRoutes } from "./routes/documents";
import { caseRoutes } from "./routes/cases";
import { reviewRoutes } from "./routes/reviews";
import { ruleRoutes } from "./routes/rules";
import { auditRoutes } from "./routes/audit";
import { integrationRoutes } from "./routes/integrations";
import { userRoutes } from "./routes/users";
import { fail } from "./response";
import { logger } from "../utils/logger";

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

  app.use("*", requestContext);
  app.use("*", securityHeaders);
  app.use(
    "/api/*",
    cors({
      origin: (origin, c) => {
        if (!origin) return origin;
        if (c.env.ENVIRONMENT === "local") return origin;
        const allowed = c.env.APP_BASE_URL.replace(/\/$/, "");
        return origin === allowed ? origin : "";
      },
      credentials: true,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Cf-Access-Jwt-Assertion",
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  // Health stays outside the API rate limiter so probes stay reliable.
  api.route("/", healthRoutes);
  // Auth kickoff must stay reachable (Access challenges it) and not burn limiter budget.
  api.route("/", authStartRoutes);
  api.use("*", async (c, next) => {
    if (
      c.req.path === "/health" ||
      c.req.path.endsWith("/health") ||
      c.req.path === "/auth/start" ||
      c.req.path.endsWith("/auth/start")
    ) {
      await next();
      return;
    }
    return apiRateLimit(c, next);
  });
  api.route("/", sessionRoutes);
  api.route("/", dashboardRoutes);
  api.route("/", documentRoutes);
  api.route("/", caseRoutes);
  api.route("/", reviewRoutes);
  api.route("/", ruleRoutes);
  api.route("/", auditRoutes);
  api.route("/", integrationRoutes);
  api.route("/", userRoutes);

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

  // Parent-level JSON fallbacks (middleware / routing failures must not be text/HTML).
  app.notFound((c) => fail(c, 404, "NOT_FOUND", "API route not found"));
  app.onError((err, c) => {
    logger.error("app_unhandled_error", {
      requestId: c.get("requestId"),
      errorCode: "INTERNAL_ERROR",
      messageText: err.message,
    });
    return fail(c, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  });

  return app;
}
