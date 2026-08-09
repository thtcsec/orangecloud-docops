import type { Context } from "hono";
import type { AppVariables } from "./middleware/context";
import type { ApiFailure, ApiSuccess } from "@shared/domain";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export function ok<T>(c: AppContext, data: T, status: 200 | 201 | 202 | 503 = 200) {
  const body: ApiSuccess<T> = {
    ok: true,
    requestId: c.get("requestId"),
    data,
  };
  return c.json(body, status);
}

export function fail(
  c: AppContext,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiFailure = {
    ok: false,
    requestId: c.get("requestId"),
    error: { code, message, details },
  };
  if (status === 429 && !c.res.headers.get("Retry-After")) {
    c.header("Retry-After", "60");
  }
  return c.json(body, status as 400);
}
