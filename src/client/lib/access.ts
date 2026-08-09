/** Build Access kickoff URL (Access-protected /api path → SPA). */
export function accessStartUrl(nextPath = "/app/dashboard"): string {
  const next = nextPath.startsWith("/app") ? nextPath : "/app/dashboard";
  return `/api/auth/start?next=${encodeURIComponent(next)}`;
}
