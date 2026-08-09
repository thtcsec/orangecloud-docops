import { createMiddleware } from "hono/factory";
import type { AppVariables } from "./context";
import { fail } from "../response";
import { logger } from "../../utils/logger";

function clientKey(request: Request, userId?: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return userId ? `${userId}:${ip}` : ip;
}

export const apiRateLimit = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const limiter = c.env.API_RATE_LIMITER;
  if (!limiter) {
    await next();
    return;
  }
  const key = clientKey(c.req.raw, c.get("principal")?.userId);
  const result = await limiter.limit({ key });
  if (!result.success) {
    logger.warn("api_rate_limited", {
      requestId: c.get("requestId"),
      key,
    });
    c.header("Retry-After", "60");
    return fail(c, 429, "RATE_LIMITED", "Too many requests. Slow down a bit.");
  }
  await next();
});

export const uploadRateLimit = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const limiter = c.env.UPLOAD_RATE_LIMITER;
  if (!limiter) {
    await next();
    return;
  }
  const principal = c.get("principal");
  const key = clientKey(c.req.raw, principal?.userId);
  const result = await limiter.limit({ key });
  if (!result.success) {
    logger.warn("upload_rate_limited", {
      requestId: c.get("requestId"),
      key,
    });
    c.header("Retry-After", "60");
    return fail(
      c,
      429,
      "UPLOAD_RATE_LIMITED",
      "Upload rate limit reached. Try again shortly.",
    );
  }
  await next();
});
