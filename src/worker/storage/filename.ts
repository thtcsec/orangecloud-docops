const UNSAFE_CHARS = /[^a-zA-Z0-9._-]+/g;
const MULTI_DOTS = /\.{2,}/g;

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "document";
  const trimmed = base.trim().replace(MULTI_DOTS, ".");
  const sanitized = trimmed.replace(UNSAFE_CHARS, "_").replace(/^_+|_+$/g, "");
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return "document.bin";
  }
  return sanitized.slice(0, 180);
}

export function getExtension(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const idx = sanitized.lastIndexOf(".");
  if (idx <= 0) return "";
  return sanitized.slice(idx + 1).toLowerCase();
}
