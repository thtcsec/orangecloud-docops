import { Hono } from "hono";
import { z } from "zod";
import { PLANNED_INTEGRATIONS } from "@shared/domain";
import type { AppVariables } from "../middleware/context";
import { requireAuth, requireRoles } from "../middleware/auth";
import { fail, ok } from "../response";
import { appendAuditEvent } from "../../domain/audit/service";
import {
  deleteOrgSetting,
  putOrgSetting,
} from "../../db/repositories/settings";
import {
  ERP_WEBHOOK_SETTING_KEY,
  postErpWebhook,
  resolveErpWebhookUrl,
} from "../../services/erp-webhook";
import { nowIso } from "../../utils/id";

function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/***`;
  } catch {
    return "***";
  }
}

function parseWebhookUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

const erpWebhookBodySchema = z.object({
  webhookUrl: z.string().max(2048),
});

export const integrationRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

integrationRoutes.get("/integrations", requireAuth, async (c) => {
  const principal = c.get("principal")!;
  const erpUrl = await resolveErpWebhookUrl(
    c.env,
    principal.organizationId,
  );
  const erpConnected = Boolean(erpUrl);

  return ok(c, {
    integrations: PLANNED_INTEGRATIONS.map((item) => {
      if (item.key === "erp_webhook") {
        return {
          ...item,
          status: erpConnected ? ("connected" as const) : ("available" as const),
          connected: erpConnected,
          configurable: true,
          webhookUrlMasked: erpUrl ? maskWebhookUrl(erpUrl) : null,
        };
      }
      if (item.key === "workers_ai") {
        const aiReady = Boolean(c.env.AI);
        return {
          ...item,
          status: aiReady ? ("connected" as const) : ("available" as const),
          connected: aiReady,
          configurable: false,
          webhookUrlMasked: null,
          detail: aiReady
            ? "PDF invoices: PDF→Markdown→LLM field extract on process."
            : "Workers AI binding not present in this environment.",
        };
      }
      return {
        ...item,
        connected: false,
        configurable: false,
        webhookUrlMasked: null,
      };
    }),
  });
});

integrationRoutes.put(
  "/integrations/erp_webhook",
  requireAuth,
  requireRoles("admin"),
  async (c) => {
    const principal = c.get("principal")!;
    const body = await c.req.json().catch(() => null);
    const parsed = erpWebhookBodySchema.safeParse(body);
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
    const raw = parsed.data.webhookUrl.trim();
    if (!raw) {
      await deleteOrgSetting(
        c.env.DOCOPS_DB,
        principal.organizationId,
        ERP_WEBHOOK_SETTING_KEY,
      );
      await appendAuditEvent(c.env.DOCOPS_DB, {
        organizationId: principal.organizationId,
        actorType: "user",
        actorId: principal.userId,
        action: "integration.erp_webhook.updated",
        entityType: "integration",
        entityId: "erp_webhook",
        requestId: c.get("requestId"),
        metadata: { cleared: true },
      });
      return ok(c, {
        connected: false,
        webhookUrlMasked: null,
      });
    }

    const url = parseWebhookUrl(raw);
    if (!url) {
      return fail(
        c,
        400,
        "VALIDATION_ERROR",
        "Webhook URL must be a valid http(s) URL",
      );
    }

    await putOrgSetting(
      c.env.DOCOPS_DB,
      principal.organizationId,
      ERP_WEBHOOK_SETTING_KEY,
      url,
      now,
    );
    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "integration.erp_webhook.updated",
      entityType: "integration",
      entityId: "erp_webhook",
      requestId: c.get("requestId"),
      metadata: { webhookUrlMasked: maskWebhookUrl(url) },
    });

    return ok(c, {
      connected: true,
      webhookUrlMasked: maskWebhookUrl(url),
    });
  },
);

integrationRoutes.post(
  "/integrations/erp_webhook/test",
  requireAuth,
  requireRoles("admin"),
  async (c) => {
    const principal = c.get("principal")!;
    const webhookUrl = await resolveErpWebhookUrl(
      c.env,
      principal.organizationId,
    );
    if (!webhookUrl) {
      return fail(
        c,
        400,
        "NOT_CONFIGURED",
        "Configure an ERP webhook URL before testing",
      );
    }

    const result = await postErpWebhook(webhookUrl, {
      event: "integration.test",
      organizationId: principal.organizationId,
      documentId: "doc_test",
      displayName: "DocOps webhook test",
      documentType: "invoice_xml",
      status: "APPROVED",
      decision: "approved",
      reviewerId: principal.userId,
      reviewerEmail: principal.email,
      comment: "Manual test from Integrations",
      requestId: c.get("requestId"),
      timestamp: nowIso(),
    });

    await appendAuditEvent(c.env.DOCOPS_DB, {
      organizationId: principal.organizationId,
      actorType: "user",
      actorId: principal.userId,
      action: "integration.erp_webhook.tested",
      entityType: "integration",
      entityId: "erp_webhook",
      requestId: c.get("requestId"),
      metadata: {
        ok: result.ok,
        status: result.status,
        message: result.ok ? undefined : result.message,
      },
    });

    if (!result.ok) {
      return fail(
        c,
        502,
        "WEBHOOK_FAILED",
        result.message || "Webhook test failed",
        { status: result.status },
      );
    }

    return ok(c, { tested: true, status: result.status });
  },
);
