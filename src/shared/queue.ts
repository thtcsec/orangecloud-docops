/** Queue payload — identifiers and object metadata only. Never include file bodies. */
export type ProcessingQueueMessage = {
  kind: "document_object_created" | "document_reprocess";
  environment: string;
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  r2ObjectKey: string;
  etag?: string;
  sha256?: string;
  mimeType?: string;
  fileSize?: number;
  operation: "process_document";
  processingVersion: string;
  requestId: string;
  enqueuedAt: string;
};
