import type { ProcessingQueueMessage } from "@shared/queue";
import { createApp } from "./api/app";
import { withSecurityHeaders } from "./api/middleware/security-headers";
import { handleQueueBatch } from "./queue/consumer";
import { DocumentProcessingWorkflow } from "./workflows/document-processing";
import { logger } from "./utils/logger";

const app = createApp();

export { DocumentProcessingWorkflow };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
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
