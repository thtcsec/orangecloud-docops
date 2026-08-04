import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { fail, ok } from "../response";
import { auditQuerySchema } from "../schemas/common";
import { listAuditEvents } from "../../domain/audit/service";
import { canViewAudit } from "../../auth/principal";

export const auditRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

auditRoutes.get("/audit", requireAuth, requireRoles("admin"), async (c) => {
  const principal = c.get("principal")!;
  if (!canViewAudit(principal.role)) {
    return fail(c, 403, "FORBIDDEN", "Audit access requires admin");
  }

  const parsed = auditQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, 400, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten());
  }

  const q = parsed.data;
  const result = await listAuditEvents(
    c.env.DOCOPS_DB,
    principal.organizationId,
    {
      actorId: q.actor,
      entityType: q.entityType,
      action: q.action,
      entityId: q.entityId,
      from: q.from,
      to: q.to,
      limit: q.pageSize,
      offset: (q.page - 1) * q.pageSize,
    },
  );

  return ok(c, {
    items: result.items,
    page: q.page,
    pageSize: q.pageSize,
    total: result.total,
  });
});
