import type { ReviewDecision, ReviewTaskStatus } from "@shared/domain";
import type { ReviewDecisionRow, ReviewTaskRow } from "../schema/types";
import { all, first, type Db } from "./base";

export async function createReviewTask(
  db: Db,
  row: ReviewTaskRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO review_tasks (
        id, organization_id, document_id, case_id, status, reason,
        assigned_to, created_at, updated_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.organization_id,
      row.document_id,
      row.case_id,
      row.status,
      row.reason,
      row.assigned_to,
      row.created_at,
      row.updated_at,
      row.resolved_at,
    )
    .run();
}

export async function getReviewTask(
  db: Db,
  organizationId: string,
  taskId: string,
): Promise<ReviewTaskRow | null> {
  return first<ReviewTaskRow>(
    db
      .prepare(
        `SELECT * FROM review_tasks WHERE id = ? AND organization_id = ? LIMIT 1`,
      )
      .bind(taskId, organizationId),
  );
}

export async function findOpenReviewTaskForDocument(
  db: Db,
  documentId: string,
): Promise<ReviewTaskRow | null> {
  return first<ReviewTaskRow>(
    db
      .prepare(
        `SELECT * FROM review_tasks
         WHERE document_id = ? AND status IN ('open','in_progress')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(documentId),
  );
}

export async function listReviewTasks(
  db: Db,
  organizationId: string,
  status: ReviewTaskStatus | undefined,
  limit: number,
  offset: number,
): Promise<{ items: ReviewTaskRow[]; total: number }> {
  const where = ["organization_id = ?"];
  const binds: unknown[] = [organizationId];
  if (status) {
    where.push("status = ?");
    binds.push(status);
  }
  const whereSql = where.join(" AND ");
  const totalRow = await first<{ c: number }>(
    db
      .prepare(`SELECT COUNT(*) as c FROM review_tasks WHERE ${whereSql}`)
      .bind(...binds),
  );
  const items = await all<ReviewTaskRow>(
    db
      .prepare(
        `SELECT * FROM review_tasks WHERE ${whereSql}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset),
  );
  return { items, total: totalRow?.c ?? 0 };
}

export async function updateReviewTask(
  db: Db,
  id: string,
  patch: Partial<ReviewTaskRow>,
): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id") continue;
    fields.push(`${key} = ?`);
    binds.push(value);
  }
  if (fields.length === 0) return;
  binds.push(id);
  await db
    .prepare(`UPDATE review_tasks SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
}

export async function createReviewDecision(
  db: Db,
  row: ReviewDecisionRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO review_decisions (
        id, review_task_id, reviewer_id, decision, comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.review_task_id,
      row.reviewer_id,
      row.decision,
      row.comment,
      row.created_at,
    )
    .run();
}

export async function listReviewDecisions(
  db: Db,
  reviewTaskId: string,
): Promise<ReviewDecisionRow[]> {
  return all<ReviewDecisionRow>(
    db
      .prepare(
        `SELECT * FROM review_decisions WHERE review_task_id = ? ORDER BY created_at ASC`,
      )
      .bind(reviewTaskId),
  );
}

export async function listReviewDecisionsForDocument(
  db: Db,
  documentId: string,
): Promise<(ReviewDecisionRow & { review_task_id: string })[]> {
  return all<ReviewDecisionRow>(
    db
      .prepare(
        `SELECT rd.*
         FROM review_decisions rd
         INNER JOIN review_tasks rt ON rt.id = rd.review_task_id
         WHERE rt.document_id = ?
         ORDER BY rd.created_at ASC`,
      )
      .bind(documentId),
  );
}

export type DecisionInput = {
  decision: ReviewDecision;
  comment?: string | null;
};
