import type { DocumentStatus } from "@shared/domain";

const ALLOWED_TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  UPLOADING: ["UPLOADED", "FAILED"],
  UPLOADED: ["QUEUED", "FAILED"],
  QUEUED: ["PROCESSING", "FAILED"],
  PROCESSING: ["EXTRACTED", "NEEDS_REVIEW", "FAILED"],
  EXTRACTED: ["VALIDATING", "NEEDS_REVIEW", "FAILED"],
  VALIDATING: ["NEEDS_REVIEW", "APPROVED", "FAILED"],
  NEEDS_REVIEW: ["APPROVED", "REJECTED", "PROCESSING", "FAILED"],
  APPROVED: ["EXPORTING", "EXPORTED"],
  REJECTED: ["QUEUED"],
  EXPORTING: ["EXPORTED", "FAILED"],
  EXPORTED: [],
  FAILED: ["QUEUED"],
};

export function canTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  if (from === to) return true; // idempotent no-op
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid document status transition: ${from} -> ${to}`);
  }
}

export function buildIdempotencyKey(
  documentVersionId: string,
  operation: string,
  processingVersion: string,
): string {
  return `${documentVersionId}:${operation}:${processingVersion}`;
}
