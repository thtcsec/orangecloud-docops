/** Secrets and optional bindings not emitted by `wrangler types` vars. */
interface Env {
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  /** Present on staging/production; omitted from local default to keep vitest offline. */
  AI?: Ai;
}
