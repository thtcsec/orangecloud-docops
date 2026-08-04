import { createId, nowIso } from "../../utils/id";
import type { Db } from "../../db/repositories/base";
import type { AuditEventRow } from "../../db/schema/types";
import { all, first } from "../../db/repositories/base";

export type AuditInput = {
  organizationId: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function appendAuditEvent(
  db: Db,
  input: AuditInput,
): Promise<AuditEventRow> {
  const row: AuditEventRow = {
    id: createId("aud"),
    organization_id: input.organizationId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    request_id: input.requestId ?? null,
    metadata_json: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: nowIso(),
  };

  await db
    .prepare(
      `INSERT INTO audit_events (
        id, organization_id, actor_type, actor_id, action,
        entity_type, entity_id, request_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.organization_id,
      row.actor_type,
      row.actor_id,
      row.action,
      row.entity_type,
      row.entity_id,
      row.request_id,
      row.metadata_json,
      row.created_at,
    )
    .run();

  return row;
}

export async function listAuditEvents(
  db: Db,
  organizationId: string,
  filters: {
    actorId?: string;
    entityType?: string;
    action?: string;
    entityId?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  },
): Promise<{ items: AuditEventRow[]; total: number }> {
  const where = ["organization_id = ?"];
  const binds: unknown[] = [organizationId];

  if (filters.actorId) {
    where.push("actor_id = ?");
    binds.push(filters.actorId);
  }
  if (filters.entityType) {
    where.push("entity_type = ?");
    binds.push(filters.entityType);
  }
  if (filters.action) {
    where.push("action = ?");
    binds.push(filters.action);
  }
  if (filters.entityId) {
    where.push("entity_id = ?");
    binds.push(filters.entityId);
  }
  if (filters.from) {
    where.push("created_at >= ?");
    binds.push(filters.from);
  }
  if (filters.to) {
    where.push("created_at <= ?");
    binds.push(filters.to);
  }

  const whereSql = where.join(" AND ");
  const totalRow = await first<{ c: number }>(
    db
      .prepare(`SELECT COUNT(*) as c FROM audit_events WHERE ${whereSql}`)
      .bind(...binds),
  );

  const items = await all<AuditEventRow>(
    db
      .prepare(
        `SELECT * FROM audit_events WHERE ${whereSql}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, filters.limit, filters.offset),
  );

  return { items, total: totalRow?.c ?? 0 };
}
