/** Secrets and optional bindings not emitted by `wrangler types` vars. */
interface Env {
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  /** Comma-separated emails elevated to admin on Access login. */
  BOOTSTRAP_ADMIN_EMAILS?: string;
  /** Optional org-wide ERP webhook fallback when not set in D1 settings. */
  ERP_WEBHOOK_URL?: string;
  /** Present on staging/production; omitted from local default to keep vitest offline. */
  AI?: Ai;
  UPLOAD_RATE_LIMITER?: RateLimit;
  API_RATE_LIMITER?: RateLimit;
}
