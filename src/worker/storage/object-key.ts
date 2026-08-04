import { sanitizeFilename } from "./filename";

export function buildR2ObjectKey(input: {
  environment: string;
  organizationId: string;
  documentId: string;
  versionId: string;
  filename: string;
}): string {
  const env = input.environment.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "local";
  const filename = sanitizeFilename(input.filename);
  return `${env}/${input.organizationId}/${input.documentId}/${input.versionId}/original/${filename}`;
}
