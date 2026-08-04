import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { requireAuth } from "../middleware/auth";
import { ok } from "../response";
import { getDashboardStats } from "../../db/repositories/documents";
import { listAuditEvents } from "../../domain/audit/service";

export const dashboardRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

dashboardRoutes.get("/dashboard", requireAuth, async (c) => {
  const principal = c.get("principal")!;
  const stats = await getDashboardStats(
    c.env.DOCOPS_DB,
    principal.organizationId,
  );
  const recentAudit = await listAuditEvents(
    c.env.DOCOPS_DB,
    principal.organizationId,
    { limit: 10, offset: 0 },
  );

  return ok(c, {
    stats: {
      totalDocuments: stats.total_documents,
      processing: stats.processing,
      needsReview: stats.needs_review,
      failed: stats.failed,
      openCases: stats.open_cases,
    },
    recentAudit: recentAudit.items,
  });
});
