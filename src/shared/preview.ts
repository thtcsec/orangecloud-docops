/** Infer inline preview kind from MIME and/or filename. */
export type PreviewKind = "pdf" | "xml" | "unsupported";

export function previewKindFromMimeAndName(
  mimeType: string | null | undefined,
  filename: string | null | undefined,
): PreviewKind {
  const mime = (mimeType || "").toLowerCase().split(";")[0]?.trim() ?? "";
  const name = (filename || "").toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/xml" ||
    mime === "text/xml" ||
    name.endsWith(".xml")
  ) {
    return "xml";
  }
  return "unsupported";
}
