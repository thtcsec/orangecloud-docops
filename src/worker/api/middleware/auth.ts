import { createMiddleware } from "hono/factory";
import { resolvePrincipal } from "../../auth/access";
import type { AppVariables } from "./context";
import type { UserRole } from "@shared/domain";
import { normalizeRole } from "@shared/domain";
import { fail } from "../response";

export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const principal = await resolvePrincipal(c.req.raw, c.env);
  if (!principal) {
    return fail(c, 401, "UNAUTHORIZED", "Authentication required");
  }
  c.set("principal", principal);
  await next();
});

export function requireRoles(...roles: UserRole[]) {
  return createMiddleware<{
    Bindings: Env;
    Variables: AppVariables;
  }>(async (c, next) => {
    const principal = c.get("principal");
    if (!principal) {
      return fail(c, 401, "UNAUTHORIZED", "Authentication required");
    }
    const role = normalizeRole(principal.role);
    if (!roles.includes(role)) {
      return fail(c, 403, "FORBIDDEN", "Insufficient permissions");
    }
    await next();
  });
}
