import { z } from "zod";
import {
  DOCUMENT_TYPES,
  REVIEW_DECISIONS,
  RELATIONSHIP_TYPES,
} from "@shared/domain";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createDocumentSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  caseId: z.string().optional(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
});

/** JSON upload body (preferred behind Cloudflare Access/WAF — avoids multipart blocks). */
export const jsonUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255).optional(),
  mimeType: z.string().min(1).max(127).optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  caseId: z.string().min(1).max(128).optional(),
  contentBase64: z.string().min(1),
});

export const createCaseSchema = z.object({
  reference: z.string().min(1).max(120),
  vendorName: z.string().min(1).max(255).optional(),
  vendorTaxId: z.string().min(1).max(64).optional(),
});

export const linkCaseDocumentSchema = z.object({
  documentId: z.string().min(1),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
});

export const reviewDecisionSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  comment: z.string().max(4000).optional(),
});

export const documentsQuerySchema = paginationSchema.extend({
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  status: z.string().optional(),
  needsReview: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  uploadedFrom: z.string().optional(),
  uploadedTo: z.string().optional(),
  search: z.string().optional(),
});

export const auditQuerySchema = paginationSchema.extend({
  actor: z.string().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  entityId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const patchCaseSchema = z
  .object({
    reference: z.string().min(1).max(120).optional(),
    vendorName: z.string().max(255).nullable().optional(),
    vendorTaxId: z.string().max(64).nullable().optional(),
    status: z.enum(["open", "in_review", "approved", "rejected", "exported"]).optional(),
  })
  .refine(
    (v) =>
      v.reference !== undefined ||
      v.vendorName !== undefined ||
      v.vendorTaxId !== undefined ||
      v.status !== undefined,
    { message: "At least one field is required" },
  );

export const patchDocumentSchema = z
  .object({
    displayName: z.string().min(1).max(255).optional(),
    documentType: z.enum(DOCUMENT_TYPES).optional(),
    caseId: z.string().max(128).nullable().optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.documentType !== undefined ||
      v.caseId !== undefined,
    { message: "At least one field is required" },
  );

export const patchExtractedFieldSchema = z.object({
  normalizedValue: z.string().max(1000).nullable().optional(),
  rawValue: z.string().max(1000).nullable().optional(),
});

export const exportDocumentsQuerySchema = z.object({
  status: z.string().optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

