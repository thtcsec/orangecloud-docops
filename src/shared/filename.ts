const UNSAFE_CHARS = /[^a-zA-Z0-9._-]+/g;
const MULTI_DOTS = /\.{2,}/g;

function rawExtension(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0) return "";
  const ext = base.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext.slice(0, 16);
}

/** Safe ASCII filename for multipart/R2 keys (always keeps a usable extension). */
export function sanitizeFilename(filename: string): string {
  const ext = rawExtension(filename);
  const base = filename.split(/[/\\]/).pop() ?? "document";
  const trimmed = base.trim().replace(MULTI_DOTS, ".");
  let sanitized = trimmed.replace(UNSAFE_CHARS, "_").replace(/^_+|_+$/g, "");

  // CJK-only basenames collapse to ".pdf" / empty — restore document.<ext>.
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return ext ? `document.${ext}` : "document.bin";
  }
  if (sanitized.startsWith(".")) {
    return ext ? `document.${ext}` : "document.bin";
  }

  // Ensure extension survived sanitization.
  const hasExt =
    ext.length > 0 && sanitized.toLowerCase().endsWith(`.${ext}`);
  if (ext && !hasExt) {
    const stem = sanitized.replace(/\.[^.]*$/, "").replace(/_+$/g, "") || "document";
    sanitized = `${stem}.${ext}`;
  }

  return sanitized.slice(0, 180);
}

export function getExtension(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const idx = sanitized.lastIndexOf(".");
  if (idx <= 0) return "";
  return sanitized.slice(idx + 1).toLowerCase();
}
