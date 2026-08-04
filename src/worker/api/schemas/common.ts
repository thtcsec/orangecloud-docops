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
