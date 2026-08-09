/** Base path for the internal ops UI (behind Cloudflare Access). */
export const APP_BASE = "/app";

/** Build an absolute app path, e.g. appPath("/documents/upload") → "/app/documents/upload". */
export function appPath(path = "/"): string {
  if (!path || path === "/") return APP_BASE;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${normalized}`;
}

/** Old top-level ops prefixes — redirect to /app… for bookmarks. */
export const LEGACY_APP_SEGMENTS = [
  "dashboard",
  "documents",
  "cases",
  "review",
  "rules",
  "audit",
  "settings",
] as const;
