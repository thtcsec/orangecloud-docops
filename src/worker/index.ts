import type { ProcessingQueueMessage } from "@shared/queue";
import { createApp } from "./api/app";
import { withSecurityHeaders } from "./api/middleware/security-headers";
import { handleQueueBatch } from "./queue/consumer";
import { DocumentProcessingWorkflow } from "./workflows/document-processing";
import { logger } from "./utils/logger";

const app = createApp();

export { DocumentProcessingWorkflow };

function normalizePathname(pathname: string): string {
  // Collapse accidental //api/... so SPA assets never answer API calls.
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/$/, "") || "/" : collapsed;
}

function jsonError(
  status: number,
  code: string,
  message: string,
  requestId?: string,
): Response {
  return Response.json(
    {
      ok: false,
      requestId: requestId ?? null,
      error: { code, message },
    },
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);

    if (pathname === "/api") {
      return Response.redirect(new URL("/api/health", url).toString(), 308);
    }

    if (pathname.startsWith("/api/")) {
      try {
        // Re-form request URL if path was normalized (e.g. //api/documents).
        const apiRequest =
          pathname === url.pathname
            ? request
            : new Request(new URL(pathname + url.search, url.origin), request);
        return await app.fetch(apiRequest, env, ctx);
      } catch (err) {
        logger.error("api_fetch_unhandled", {
          errorCode: "INTERNAL_ERROR",
          messageText: err instanceof Error ? err.message : "unknown",
          path: pathname,
        });
        return jsonError(
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred",
        );
      }
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse, env.ENVIRONMENT);
  },

  async queue(
    batch: MessageBatch<ProcessingQueueMessage>,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    try {
      await handleQueueBatch(batch, env);
    } catch (err) {
      logger.error("queue_batch_failed", {
        errorCode: "QUEUE_BATCH_FAILED",
        messageText: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  },
} satisfies ExportedHandler<Env, ProcessingQueueMessage>;
