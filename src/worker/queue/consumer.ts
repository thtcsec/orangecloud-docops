import type { ProcessingQueueMessage } from "@shared/queue";
import { createId, nowIso } from "../utils/id";
import { logger } from "../utils/logger";
import { buildIdempotencyKey } from "../domain/documents/status-machine";
import {
  createProcessingRun,
  getDocumentById,
  getProcessingRunByIdempotencyKey,
  getVersion,
  updateProcessingRun,
} from "../db/repositories/documents";
import { transitionDocumentStatus } from "../domain/documents/service";
import { appendAuditEvent } from "../domain/audit/service";

function isProcessingMessage(body: unknown): body is ProcessingQueueMessage {
  if (!body || typeof body !== "object") return false;
  const m = body as ProcessingQueueMessage;
  return (
    typeof m.documentId === "string" &&
    typeof m.documentVersionId === "string" &&
    typeof m.r2ObjectKey === "string" &&
    typeof m.organizationId === "string" &&
    m.operation === "process_document"
  );
}

export async function handleQueueBatch(
  batch: MessageBatch<ProcessingQueueMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const requestId = createId("req");
    try {
      if (!isProcessingMessage(message.body)) {
        logger.error("queue_invalid_message", {
          requestId,
          messageId: message.id,
          queueAttempt: message.attempts,
          errorCode: "INVALID_QUEUE_MESSAGE",
        });
        message.ack();
        continue;
      }

      const body = message.body;
      logger.info("queue_message_received", {
        requestId: body.requestId || requestId,
        messageId: message.id,
        documentId: body.documentId,
        documentVersionId: body.documentVersionId,
        organizationId: body.organizationId,
        queueAttempt: message.attempts,
      });

      const version = await getVersion(env.DOCOPS_DB, body.documentVersionId);
      if (!version) {
        logger.error("queue_version_not_found", {
          requestId,
          messageId: message.id,
          documentVersionId: body.documentVersionId,
          errorCode: "VERSION_NOT_FOUND",
        });
        message.retry();
        continue;
      }

      const document = await getDocumentById(env.DOCOPS_DB, body.documentId);
      if (!document) {
        logger.error("queue_document_not_found", {
          requestId,
          messageId: message.id,
          documentId: body.documentId,
          errorCode: "DOCUMENT_NOT_FOUND",
        });
        message.retry();
        continue;
      }

      const idempotencyKey = buildIdempotencyKey(
        body.documentVersionId,
        body.operation,
        body.processingVersion || env.PROCESSING_VERSION || "v1",
      );

      let run = await getProcessingRunByIdempotencyKey(
        env.DOCOPS_DB,
        idempotencyKey,
      );

      if (run?.workflow_instance_id && run.status !== "failed") {
        logger.info("queue_idempotent_skip", {
          requestId,
          messageId: message.id,
          documentId: body.documentId,
          documentVersionId: body.documentVersionId,
          processingRunId: run.id,
          workflowInstanceId: run.workflow_instance_id,
          queueAttempt: message.attempts,
        });
        message.ack();
        continue;
      }

      if (!run) {
        run = {
          id: createId("run"),
          document_version_id: body.documentVersionId,
          workflow_instance_id: null,
          provider: "none",
          provider_model: null,
          status: "pending",
          attempt: message.attempts,
          idempotency_key: idempotencyKey,
          started_at: null,
          completed_at: null,
          error_code: null,
          error_message: null,
          created_at: nowIso(),
        };
        await createProcessingRun(env.DOCOPS_DB, run);
      }

      await transitionDocumentStatus(env.DOCOPS_DB, {
        organizationId: body.organizationId,
        documentId: body.documentId,
        to: "PROCESSING",
        actorType: "system",
        actorId: "queue",
        requestId: body.requestId || requestId,
        metadata: { processingRunId: run.id, messageId: message.id },
      });

      const instanceId = `docproc-${body.documentVersionId}-${body.processingVersion || "v1"}`;
      let instance;
      try {
        instance = await env.DOCUMENT_WORKFLOW.create({
          id: instanceId,
          params: {
            organizationId: body.organizationId,
            documentId: body.documentId,
            documentVersionId: body.documentVersionId,
            processingRunId: run.id,
            r2ObjectKey: body.r2ObjectKey,
            requestId: body.requestId || requestId,
          },
        });
      } catch {
        // Duplicate delivery may race on instance id; attach to existing instance.
        instance = await env.DOCUMENT_WORKFLOW.get(instanceId);
      }

      await updateProcessingRun(env.DOCOPS_DB, run.id, {
        workflow_instance_id: instance.id,
        status: "running",
        started_at: nowIso(),
        attempt: message.attempts,
      });

      await appendAuditEvent(env.DOCOPS_DB, {
        organizationId: body.organizationId,
        actorType: "system",
        actorId: "queue",
        action: "processing.workflow.started",
        entityType: "processing_run",
        entityId: run.id,
        requestId: body.requestId || requestId,
        metadata: {
          workflowInstanceId: instance.id,
          documentId: body.documentId,
          documentVersionId: body.documentVersionId,
        },
      });

      logger.info("queue_workflow_started", {
        requestId: body.requestId || requestId,
        messageId: message.id,
        documentId: body.documentId,
        documentVersionId: body.documentVersionId,
        processingRunId: run.id,
        workflowInstanceId: instance.id,
        queueAttempt: message.attempts,
      });

      message.ack();
    } catch (err) {
      logger.error("queue_message_failed", {
        requestId,
        messageId: message.id,
        queueAttempt: message.attempts,
        errorCode: "QUEUE_HANDLER_ERROR",
        messageText: err instanceof Error ? err.message : "unknown",
      });
      message.retry();
    }
  }
}
