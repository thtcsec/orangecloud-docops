import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { createId, nowIso } from "../utils/id";
import { logger } from "../utils/logger";
import {
  clearExtractedFieldsForRun,
  createExtractedField,
  getDocumentById,
  getVersion,
  updateProcessingRun,
} from "../db/repositories/documents";
import {
  clearRuleResultsForDocument,
  createRuleResult,
} from "../db/repositories/cases";
import { transitionDocumentStatus } from "../domain/documents/service";
import { appendAuditEvent } from "../domain/audit/service";
import {
  findOpenReviewTaskForDocument,
  createReviewTask,
} from "../db/repositories/reviews";
import {
  HeuristicClassifier,
  NotConfiguredConverter,
  NotConfiguredExtractor,
  PassthroughNormalizer,
  VietnamInvoiceXmlParser,
  WorkersAiPdfExtractor,
  evaluateDocumentRules,
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
 * Document processing Workflow.
 * Phase 1.5+: VN invoice XML parse, Workers AI PDF invoice extract, C2P rules.
 * Still routes to human review — never silently auto-approves.
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
        caseId: document.case_id,
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
      const classifier = new HeuristicClassifier();
      return classifier.classify({
        mimeType: meta.mimeType,
        filename: meta.filename,
        r2ObjectKey: meta.r2ObjectKey,
      });
    });

    const strategy = await step.do("select-processing-strategy", async () => {
      if (detected.documentType === "invoice_xml") {
        return {
          strategy: "vietnam_invoice_xml_parser",
          provider: "vietnam-invoice-xml",
        };
      }
      if (detected.documentType === "invoice_pdf" && this.env.AI) {
        return { strategy: "workers_ai_pdf", provider: "workers-ai" };
      }
      return { strategy: "extraction_unavailable", provider: "none" };
    });

    const processing = await step.do("extract-normalize-validate", async () => {
      const converter = new NotConfiguredConverter();
      const conversion = await converter.convert({
        r2ObjectKey: params.r2ObjectKey,
        mimeType: meta.mimeType,
      });

      let extraction =
        strategy.strategy === "vietnam_invoice_xml_parser"
          ? await (async () => {
              const obj = await this.env.DOCUMENTS_BUCKET.get(params.r2ObjectKey);
              if (!obj) {
                return {
                  configured: true,
                  provider: "vietnam-invoice-xml",
                  fields: [],
                  message: "R2 object missing at parse time",
                };
              }
              const xmlText = await obj.text();
              return new VietnamInvoiceXmlParser().parse({ xmlText });
            })()
          : strategy.strategy === "workers_ai_pdf"
            ? await (async () => {
                const obj = await this.env.DOCUMENTS_BUCKET.get(
                  params.r2ObjectKey,
                );
                if (!obj) {
                  return {
                    configured: true,
                    provider: "workers-ai",
                    fields: [],
                    message: "R2 object missing at PDF extract time",
                  };
                }
                const bytes = await obj.arrayBuffer();
                return new WorkersAiPdfExtractor(this.env.AI).extract({
                  r2ObjectKey: params.r2ObjectKey,
                  mimeType: meta.mimeType,
                  filename: meta.filename,
                  bytes,
                });
              })()
            : await new NotConfiguredExtractor().extract({
                r2ObjectKey: params.r2ObjectKey,
                mimeType: meta.mimeType,
              });

      const normalized = await new PassthroughNormalizer().normalize({
        fields: extraction.fields,
      });
      extraction = { ...extraction, fields: normalized.fields };

      await clearExtractedFieldsForRun(
        this.env.DOCOPS_DB,
        params.processingRunId,
      );

      const now = nowIso();
      for (const field of extraction.fields) {
        await createExtractedField(this.env.DOCOPS_DB, {
          id: createId("xf"),
          processing_run_id: params.processingRunId,
          document_version_id: params.documentVersionId,
          field_name: field.fieldName,
          raw_value: field.rawValue,
          normalized_value: field.normalizedValue,
          value_type: field.valueType,
          confidence: field.confidence,
          source_kind: field.sourceKind,
          source_reference: field.sourceReference ?? null,
          provider: extraction.provider,
          model_version: "v1",
          created_at: now,
        });
      }

      if (extraction.fields.length > 0) {
        await transitionDocumentStatus(this.env.DOCOPS_DB, {
          organizationId: params.organizationId,
          documentId: params.documentId,
          to: "EXTRACTED",
          actorType: "system",
          actorId: "workflow",
          requestId: params.requestId,
          metadata: {
            processingRunId: params.processingRunId,
            fieldCount: extraction.fields.length,
          },
        });

        await transitionDocumentStatus(this.env.DOCOPS_DB, {
          organizationId: params.organizationId,
          documentId: params.documentId,
          to: "VALIDATING",
          actorType: "system",
          actorId: "workflow",
          requestId: params.requestId,
          metadata: { processingRunId: params.processingRunId },
        });
      }

      await clearRuleResultsForDocument(this.env.DOCOPS_DB, params.documentId);

      const rules = await evaluateDocumentRules({
        db: this.env.DOCOPS_DB,
        organizationId: params.organizationId,
        documentId: params.documentId,
        caseId: meta.caseId,
        fields: extraction.fields,
      });

      for (const result of rules.results) {
        await createRuleResult(this.env.DOCOPS_DB, {
          id: createId("rr"),
          case_id: meta.caseId,
          document_id: params.documentId,
          rule_key: result.ruleKey,
          rule_version: result.ruleVersion,
          status: result.status,
          severity: result.severity,
          expected_value: result.expectedValue,
          actual_value: result.actualValue,
          explanation: result.explanation,
          created_at: now,
        });
      }

      const failCount = rules.results.filter((r) => r.status === "fail").length;
      const warnCount = rules.results.filter(
        (r) => r.status === "warning",
      ).length;

      await updateProcessingRun(this.env.DOCOPS_DB, params.processingRunId, {
        provider: extraction.provider,
        provider_model: strategy.provider,
        status: "waiting_review",
      });

      await appendAuditEvent(this.env.DOCOPS_DB, {
        organizationId: params.organizationId,
        actorType: "system",
        actorId: "workflow",
        action:
          extraction.fields.length > 0
            ? "processing.extraction.completed"
            : "processing.extraction.unavailable",
        entityType: "processing_run",
        entityId: params.processingRunId,
        requestId: params.requestId,
        metadata: {
          strategy: strategy.strategy,
          extractionConfigured: extraction.configured,
          conversionConfigured: conversion.configured,
          message: extraction.message,
          detectedType: detected.documentType,
          fieldCount: extraction.fields.length,
          ruleFailCount: failCount,
          ruleWarnCount: warnCount,
        },
      });

      return {
        extractionConfigured: extraction.configured,
        fieldCount: extraction.fields.length,
        message: extraction.message,
        failCount,
        warnCount,
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
        const reasonParts = [
          processing.fieldCount > 0
            ? `Parsed ${processing.fieldCount} field(s).`
            : "No structured fields extracted.",
          processing.failCount > 0
            ? `${processing.failCount} rule fail(s).`
            : null,
          processing.warnCount > 0
            ? `${processing.warnCount} rule warning(s).`
            : null,
          "Human review required before approval.",
        ].filter(Boolean);

        task = {
          id: createId("rev"),
          organization_id: params.organizationId,
          document_id: params.documentId,
          case_id: meta.caseId,
          status: "open",
          reason: reasonParts.join(" "),
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
      fieldCount: processing.fieldCount,
    };
  }
}
