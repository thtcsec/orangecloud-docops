import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { createId, nowIso } from "../utils/id";
import { logger } from "../utils/logger";
import {
  getDocumentById,
  getVersion,
  updateProcessingRun,
} from "../db/repositories/documents";
import { transitionDocumentStatus } from "../domain/documents/service";
import { appendAuditEvent } from "../domain/audit/service";
import {
  findOpenReviewTaskForDocument,
  createReviewTask,
} from "../db/repositories/reviews";
import {
  NotConfiguredClassifier,
  NotConfiguredConverter,
  NotConfiguredExtractor,
  NotConfiguredVietnamInvoiceXmlParser,
} from "../providers/interfaces";

export type DocumentWorkflowParams = {
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  processingRunId: string;
  r2ObjectKey: string;
  requestId: string;
};

export type ReviewDecisionEvent = {
  decision: "approved" | "rejected" | "correction_requested";
  reviewTaskId: string;
  reviewerId: string;
  comment?: string;
};

/**
 * Phase 1 document processing Workflow skeleton.
 * Does not fabricate AI extraction. Routes to human review when no provider is configured.
 */
export class DocumentProcessingWorkflow extends WorkflowEntrypoint<
  Env,
  DocumentWorkflowParams
> {
  async run(
    event: WorkflowEvent<DocumentWorkflowParams>,
    step: WorkflowStep,
  ) {
    const params = event.payload;

    const meta = await step.do("load-document-metadata", async () => {
      const document = await getDocumentById(
        this.env.DOCOPS_DB,
        params.documentId,
      );
      const version = await getVersion(
        this.env.DOCOPS_DB,
        params.documentVersionId,
      );
      if (!document || !version) {
        throw new Error("DOCUMENT_OR_VERSION_NOT_FOUND");
      }
      return {
        documentId: document.id,
        organizationId: document.organization_id,
        status: document.status,
        mimeType: version.mime_type,
        filename: version.original_filename,
        r2ObjectKey: version.r2_object_key,
      };
    });

    await step.do("verify-r2-object", async () => {
      const obj = await this.env.DOCUMENTS_BUCKET.head(params.r2ObjectKey);
      if (!obj) {
        throw new Error("R2_OBJECT_MISSING");
      }
      return {
        size: obj.size,
        etag: obj.etag,
        httpContentType: obj.httpMetadata?.contentType ?? null,
      };
    });

    const detected = await step.do("detect-file-type", async () => {
      const classifier = new NotConfiguredClassifier();
      return classifier.classify({
        mimeType: meta.mimeType,
        filename: meta.filename,
        r2ObjectKey: meta.r2ObjectKey,
      });
    });

    const strategy = await step.do("select-processing-strategy", async () => {
      if (detected.documentType === "invoice_xml") {
        return { strategy: "vietnam_invoice_xml_parser", provider: "none" };
      }
      return { strategy: "extraction_unavailable", provider: "none" };
    });

    await step.do("create-processing-result", async () => {
      const extractor = new NotConfiguredExtractor();
      const xmlParser = new NotConfiguredVietnamInvoiceXmlParser();
      const converter = new NotConfiguredConverter();

      const extraction =
        strategy.strategy === "vietnam_invoice_xml_parser"
          ? await xmlParser.parse({ r2ObjectKey: params.r2ObjectKey })
          : await extractor.extract({
              r2ObjectKey: params.r2ObjectKey,
              mimeType: meta.mimeType,
            });
      const conversion = await converter.convert({
        r2ObjectKey: params.r2ObjectKey,
        mimeType: meta.mimeType,
      });

      await updateProcessingRun(this.env.DOCOPS_DB, params.processingRunId, {
        provider: extraction.provider,
        provider_model: null,
        status: "waiting_review",
      });

      await appendAuditEvent(this.env.DOCOPS_DB, {
        organizationId: params.organizationId,
        actorType: "system",
        actorId: "workflow",
        action: "processing.extraction.unavailable",
        entityType: "processing_run",
        entityId: params.processingRunId,
        requestId: params.requestId,
        metadata: {
          strategy: strategy.strategy,
          extractionConfigured: extraction.configured,
          conversionConfigured: conversion.configured,
          message: extraction.message,
          detectedType: detected.documentType,
        },
      });

      return {
        extractionConfigured: extraction.configured,
        message: extraction.message,
      };
    });

    const reviewTaskId = await step.do("route-to-needs-review", async () => {
      await transitionDocumentStatus(this.env.DOCOPS_DB, {
        organizationId: params.organizationId,
        documentId: params.documentId,
        to: "NEEDS_REVIEW",
        actorType: "system",
        actorId: "workflow",
        requestId: params.requestId,
        metadata: { processingRunId: params.processingRunId },
      });

      let task = await findOpenReviewTaskForDocument(
        this.env.DOCOPS_DB,
        params.documentId,
      );
      if (!task) {
        const now = nowIso();
        task = {
          id: createId("rev"),
          organization_id: params.organizationId,
          document_id: params.documentId,
          case_id: null,
          status: "open",
          reason:
            "Extraction provider not configured in Phase 1. Human review required.",
          assigned_to: null,
          created_at: now,
          updated_at: now,
          resolved_at: null,
        };
        await createReviewTask(this.env.DOCOPS_DB, task);
        await appendAuditEvent(this.env.DOCOPS_DB, {
          organizationId: params.organizationId,
          actorType: "system",
          actorId: "workflow",
          action: "review.task.created",
          entityType: "review_task",
          entityId: task.id,
          requestId: params.requestId,
          metadata: { documentId: params.documentId },
        });
      }
      return task.id;
    });

    let decisionPayload: ReviewDecisionEvent | null = null;
    try {
      const decisionEvent = await step.waitForEvent<ReviewDecisionEvent>(
        "wait-for-human-decision",
        {
          type: "review-decision",
          timeout: "30 days",
        },
      );
      decisionPayload = decisionEvent.payload;
    } catch (err) {
      logger.warn("workflow_review_wait_timeout_or_error", {
        requestId: params.requestId,
        documentId: params.documentId,
        documentVersionId: params.documentVersionId,
        processingRunId: params.processingRunId,
        workflowInstanceId: event.instanceId,
        errorCode: "REVIEW_WAIT_TIMEOUT",
        messageText: err instanceof Error ? err.message : "unknown",
      });
    }

    await step.do("record-decision-and-complete", async () => {
      if (!decisionPayload) {
        await updateProcessingRun(this.env.DOCOPS_DB, params.processingRunId, {
          status: "waiting_review",
          error_code: "AWAITING_REVIEW",
          error_message: "Workflow waiting for human review decision",
        });
        return { completed: false, reviewTaskId };
      }

      const nextStatus =
        decisionPayload.decision === "approved"
          ? "APPROVED"
          : decisionPayload.decision === "rejected"
            ? "REJECTED"
            : "FAILED";

      await transitionDocumentStatus(this.env.DOCOPS_DB, {
        organizationId: params.organizationId,
        documentId: params.documentId,
        to: nextStatus,
        actorType: "user",
        actorId: decisionPayload.reviewerId,
        requestId: params.requestId,
        metadata: {
          reviewTaskId: decisionPayload.reviewTaskId,
          decision: decisionPayload.decision,
        },
      });

      await updateProcessingRun(this.env.DOCOPS_DB, params.processingRunId, {
        status:
          decisionPayload.decision === "approved" ? "completed" : "failed",
        completed_at: nowIso(),
        error_code:
          decisionPayload.decision === "approved"
            ? null
            : decisionPayload.decision,
        error_message: decisionPayload.comment ?? null,
      });

      await appendAuditEvent(this.env.DOCOPS_DB, {
        organizationId: params.organizationId,
        actorType: "system",
        actorId: "workflow",
        action: "processing.run.completed",
        entityType: "processing_run",
        entityId: params.processingRunId,
        requestId: params.requestId,
        metadata: {
          decision: decisionPayload.decision,
          reviewTaskId: decisionPayload.reviewTaskId,
        },
      });

      return {
        completed: true,
        decision: decisionPayload.decision,
        reviewTaskId,
      };
    });

    return {
      documentId: params.documentId,
      processingRunId: params.processingRunId,
      reviewTaskId,
      detectedType: detected.documentType,
    };
  }
}
