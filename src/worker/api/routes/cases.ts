import { Hono } from "hono";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { fail, ok } from "../response";
import {
  createCaseSchema,
  linkCaseDocumentSchema,
  paginationSchema,
} from "../schemas/common";
import {
  countExceptions,
  createCase,
  getCase,
  linkCaseDocument,
  listCaseDocuments,
  listCases,
  listRuleResultsForCase,
} from "../../db/repositories/cases";
import { getDocument, updateDocument } from "../../db/repositories/documents";
import { appendAuditEvent } from "../../domain/audit/service";
import { listAuditEvents } from "../../domain/audit/service";
import { createId, nowIso } from "../../utils/id";
import { listReviewTasks } from "../../db/repositories/reviews";

export const caseRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

caseRoutes.get("/cases", requireAuth, async (c) => {
  const principal = c.get("principal")!;
  const parsed = paginationSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return fail(c, 400, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten());
  }
  const { page, pageSize } = parsed.data;
  const result = await listCases(
    c.env.DOCOPS_DB,
    principal.organizationId,
    pageSize,
    (page - 1) * pageSize,
  );

  const items = await Promise.all(
    result.items.map(async (item) => {
      const links = await listCaseDocuments(c.env.DOCOPS_DB, item.id);
      const exceptions = await countExceptions(c.env.DOCOPS_DB, item.id);
      return {
        ...item,
        linkedDocuments: links.length,
        exceptions,
        relationships: links.map((l) => ({
          documentId: l.document_id,
          relationshipType: l.relationship_type,
          displayName: l.document.display_name,
          status: l.document.status,
        })),
      };
    }),
  );

  return ok(c, { items, page, pageSize, total: result.total });
});

caseRoutes.post(
  "/cases",
  requireAuth,
  requireRoles("admin", "reviewer"),
  async (c) => {
    const principal = c.get("principal")!;
    const body = await c.req.json().catch(() => null);
    const parsed = createCaseSchema.safeParse(body);
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
    const row = {
      id: createId("case"),
      organization_id: principal.organizationId,
      reference: parsed.data.reference,
      vendor_name: parsed.data.vendorName ?? null,
      vendor_tax_id: parsed.data.vendorTaxId ?? null,
      status: "open" as const,
      created_by: principal.userId,
      created_at: now,
      updated_at: now,
    };

    try {
      await createCase(c.env.DOCOPS_DB, row);
    } catch {
      return fail(c, 409, "CASE_EXISTS", "Case reference already exists");
    }

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "case.created",
      entityType: "case",
      entityId: row.id,
      requestId: c.get("requestId"),
      metadata: { reference: row.reference },
    });

    return ok(c, { case: row }, 201);
  },
);

caseRoutes.get("/cases/:caseId", requireAuth, async (c) => {
  const principal = c.get("principal")!;
  const caseId = c.req.param("caseId");
  const item = await getCase(c.env.DOCOPS_DB, principal.organizationId, caseId);
  if (!item) return fail(c, 404, "NOT_FOUND", "Case not found");

  const links = await listCaseDocuments(c.env.DOCOPS_DB, caseId);
  const rules = await listRuleResultsForCase(c.env.DOCOPS_DB, caseId);
  const audit = await listAuditEvents(
    c.env.DOCOPS_DB,
    principal.organizationId,
    { entityId: caseId, entityType: "case", limit: 50, offset: 0 },
  );
  const reviews = await listReviewTasks(
    c.env.DOCOPS_DB,
    principal.organizationId,
    undefined,
    50,
    0,
  );

  return ok(c, {
    case: item,
    documents: links,
    ruleResults: rules,
    validationSummary: {
      total: rules.length,
      fail: rules.filter((r) => r.status === "fail").length,
      warning: rules.filter((r) => r.status === "warning").length,
      pass: rules.filter((r) => r.status === "pass").length,
      notEvaluated: rules.filter((r) => r.status === "not_evaluated").length,
    },
    exceptions: rules.filter((r) => r.status === "fail" || r.status === "warning"),
    reviewTasks: reviews.items.filter((t) => t.case_id === caseId),
    auditEvents: audit.items,
  });
});

caseRoutes.post(
  "/cases/:caseId/documents",
  requireAuth,
  requireRoles("admin", "reviewer"),
  async (c) => {
    const principal = c.get("principal")!;
    const caseId = c.req.param("caseId");
    const item = await getCase(
      c.env.DOCOPS_DB,
      principal.organizationId,
      caseId,
    );
    if (!item) return fail(c, 404, "NOT_FOUND", "Case not found");

    const body = await c.req.json().catch(() => null);
    const parsed = linkCaseDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Invalid request body",
        parsed.error.flatten(),
      );
    }

    const doc = await getDocument(
      c.env.DOCOPS_DB,
      principal.organizationId,
      parsed.data.documentId,
    );
    if (!doc) return fail(c, 404, "NOT_FOUND", "Document not found");

    const now = nowIso();
    await linkCaseDocument(c.env.DOCOPS_DB, {
      case_id: caseId,
      document_id: parsed.data.documentId,
      relationship_type: parsed.data.relationshipType,
      created_at: now,
    });
    await updateDocument(c.env.DOCOPS_DB, doc.id, {
      case_id: caseId,
      updated_at: now,
    });

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "case.document.linked",
      entityType: "case",
      entityId: caseId,
      requestId: c.get("requestId"),
      metadata: {
        documentId: parsed.data.documentId,
        relationshipType: parsed.data.relationshipType,
      },
    });

    return ok(c, { linked: true }, 201);
  },
);
