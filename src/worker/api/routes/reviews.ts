import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { fail, ok } from "../response";
import { paginationSchema, reviewDecisionSchema } from "../schemas/common";
import {
  createReviewDecision,
  getReviewTask,
  listReviewDecisions,
  listReviewTasks,
  updateReviewTask,
} from "../../db/repositories/reviews";
import {
  getDocument,
  getLatestProcessingResult,
} from "../../db/repositories/documents";
import { appendAuditEvent } from "../../domain/audit/service";
import { canReview } from "../../auth/principal";
import { createId, nowIso } from "../../utils/id";
import { transitionDocumentStatus } from "../../domain/documents/service";
import { exportApprovedDocument } from "../../services/export-approved";
import { logger } from "../../utils/logger";

const reviewsQuerySchema = paginationSchema.extend({
  status: z.enum(["open", "in_progress", "resolved", "cancelled"]).optional(),
});

export const reviewRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

reviewRoutes.get(
  "/reviews",
  requireAuth,
  requireRoles("admin", "reviewer"),
  async (c) => {
    const principal = c.get("principal")!;
    const parsed = reviewsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Invalid query",
        parsed.error.flatten(),
      );
    }
    const { page, pageSize, status } = parsed.data;
    const result = await listReviewTasks(
      c.env.DOCOPS_DB,
      principal.organizationId,
      status,
      pageSize,
      (page - 1) * pageSize,
    );
    return ok(c, {
      items: result.items,
      page,
      pageSize,
      total: result.total,
    });
  },
);

reviewRoutes.get(
  "/reviews/:reviewTaskId",
  requireAuth,
  requireRoles("admin", "reviewer"),
  async (c) => {
    const principal = c.get("principal")!;
    const task = await getReviewTask(
      c.env.DOCOPS_DB,
      principal.organizationId,
      c.req.param("reviewTaskId"),
    );
    if (!task) return fail(c, 404, "NOT_FOUND", "Review task not found");
    const decisions = await listReviewDecisions(c.env.DOCOPS_DB, task.id);
    const document = task.document_id
      ? await getDocument(
          c.env.DOCOPS_DB,
          principal.organizationId,
          task.document_id,
        )
      : null;
    return ok(c, { task, decisions, document });
  },
);

reviewRoutes.post(
  "/reviews/:reviewTaskId/decision",
  requireAuth,
  requireRoles("admin", "reviewer"),
  async (c) => {
    const principal = c.get("principal")!;
    if (!canReview(principal.role)) {
      return fail(c, 403, "FORBIDDEN", "Review not permitted");
    }

    const task = await getReviewTask(
      c.env.DOCOPS_DB,
      principal.organizationId,
      c.req.param("reviewTaskId"),
    );
    if (!task) return fail(c, 404, "NOT_FOUND", "Review task not found");
    if (task.status === "resolved" || task.status === "cancelled") {
      return fail(c, 409, "TASK_CLOSED", "Review task is already closed");
    }

    const body = await c.req.json().catch(() => null);
    const parsed = reviewDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Invalid request body",
        parsed.error.flatten(),
      );
    }

    const now = nowIso();
    const decisionId = createId("dec");
    await createReviewDecision(c.env.DOCOPS_DB, {
      id: decisionId,
      review_task_id: task.id,
      reviewer_id: principal.userId,
      decision: parsed.data.decision,
      comment: parsed.data.comment ?? null,
      created_at: now,
    });

    await updateReviewTask(c.env.DOCOPS_DB, task.id, {
      status: "resolved",
      assigned_to: principal.userId,
      updated_at: now,
      resolved_at: now,
    });

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "review.decision.created",
      entityType: "review_task",
      entityId: task.id,
      requestId: c.get("requestId"),
      metadata: {
        decisionId,
        decision: parsed.data.decision,
        documentId: task.document_id,
        caseId: task.case_id,
      },
    });

    let exportOutcome:
      | { exportStatus: "skipped" }
      | { exportStatus: "exported" }
      | { exportStatus: "failed"; exportError: string }
      | { exportStatus: "n/a" } = { exportStatus: "n/a" };

    if (task.document_id) {
      const next =
        parsed.data.decision === "approved"
          ? "APPROVED"
          : parsed.data.decision === "rejected"
            ? "REJECTED"
            : "FAILED";
      await transitionDocumentStatus(c.env.DOCOPS_DB, {
        organizationId: principal.organizationId,
        documentId: task.document_id,
        to: next,
        actorType: "user",
        actorId: principal.userId,
        requestId: c.get("requestId"),
        metadata: {
          reviewTaskId: task.id,
          decision: parsed.data.decision,
        },
      });

      if (parsed.data.decision === "approved") {
        exportOutcome = await exportApprovedDocument({
          env: c.env,
          db: c.env.DOCOPS_DB,
          organizationId: principal.organizationId,
          documentId: task.document_id,
          actorId: principal.userId,
          actorEmail: principal.email,
          decision: parsed.data.decision,
          comment: parsed.data.comment,
          requestId: c.get("requestId") || "unknown",
          reviewTaskId: task.id,
        });
      }

      try {
        const doc = await getDocument(
          c.env.DOCOPS_DB,
          principal.organizationId,
          task.document_id,
        );
        if (doc?.current_version_id) {
          const run = await getLatestProcessingResult(
            c.env.DOCOPS_DB,
            doc.current_version_id,
          );
          if (run?.workflow_instance_id) {
            const instance = await c.env.DOCUMENT_WORKFLOW.get(
              run.workflow_instance_id,
            );
            await instance.sendEvent({
              type: "review-decision",
              payload: {
                decision: parsed.data.decision,
                reviewTaskId: task.id,
                reviewerId: principal.userId,
                comment: parsed.data.comment,
              },
            });
          }
        }
      } catch (err) {
        logger.warn("workflow_send_event_failed", {
          requestId: c.get("requestId"),
          documentId: task.document_id ?? undefined,
          errorCode: "WORKFLOW_EVENT_FAILED",
          messageText: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return ok(c, {
      decisionId,
      decision: parsed.data.decision,
      reviewTaskId: task.id,
      documentId: task.document_id,
      documentStatus:
        parsed.data.decision === "approved"
          ? exportOutcome.exportStatus === "exported"
            ? "EXPORTED"
            : "APPROVED"
          : parsed.data.decision === "rejected"
            ? "REJECTED"
            : "FAILED",
      ...exportOutcome,
    });
  },
);
