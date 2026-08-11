import { getOrgSetting } from "../db/repositories/settings";
import { logger } from "../utils/logger";

export const ERP_WEBHOOK_SETTING_KEY = "erp_webhook_url";

export async function resolveErpWebhookUrl(
  env: Env,
  organizationId: string,
): Promise<string | null> {
  const fromDb = await getOrgSetting(
    env.DOCOPS_DB,
    organizationId,
    ERP_WEBHOOK_SETTING_KEY,
  );
  const url = (fromDb || env.ERP_WEBHOOK_URL || "").trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export type ErpWebhookPayload = {
  event: string;
  organizationId: string;
  documentId: string;
  displayName: string;
  documentType: string;
  status: string;
  decision?: string;
  caseId?: string | null;
  reviewerId?: string;
  reviewerEmail?: string;
  comment?: string | null;
  requestId?: string;
  timestamp: string;
};

export async function postErpWebhook(
  webhookUrl: string,
  payload: ErpWebhookPayload,
): Promise<{ ok: true; status: number } | { ok: false; status: number; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "OrangeCloud-DocOps/1.0",
        "x-docops-event": payload.event,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: text.slice(0, 200) || `Webhook HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    logger.warn("erp_webhook_failed", {
      messageText: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Webhook request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
