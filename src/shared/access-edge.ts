/** Pure helpers for Cloudflare Access / edge HTML challenges (safe for unit tests). */

function urlLooksLikeAccess(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("cloudflareaccess.com") ||
    u.includes("/cdn-cgi/access/") ||
    u.includes("cf-access-login")
  );
}

export function isAccessChallenge(opts: {
  status: number;
  body: string;
  responseUrl?: string;
  wwwAuthenticate?: string | null;
  location?: string | null;
}): boolean {
  if (opts.wwwAuthenticate && /cloudflare-access/i.test(opts.wwwAuthenticate)) {
    return true;
  }
  if (opts.location && urlLooksLikeAccess(opts.location)) {
    return true;
  }
  if (opts.responseUrl && urlLooksLikeAccess(opts.responseUrl)) {
    return true;
  }
  // 3xx only counts as Access when Location/URL evidence exists (not empty Location).
  if (
    [301, 302, 303, 307, 308].includes(opts.status) &&
    opts.location &&
    urlLooksLikeAccess(opts.location)
  ) {
    return true;
  }
  // Access AJAX mode: tiny HTML pages (401/403/302) with no marketing copy.
  if (
    [401, 403, 302].includes(opts.status) &&
    /<title>\s*(401 Unauthorized|403 Forbidden|302 Found)\s*<\/title>/i.test(
      opts.body,
    ) &&
    /cloudflare/i.test(opts.body)
  ) {
    return true;
  }
  return (
    /cdn-cgi\/access\//i.test(opts.body) ||
    /cloudflareaccess\.com\/cdn-cgi\//i.test(opts.body) ||
    /name=["']cf-access-/i.test(opts.body) ||
    /id=["']cf-access-/i.test(opts.body) ||
    /data-cf-access/i.test(opts.body) ||
    /window\.location\.replace\([^)]*cloudflareaccess\.com/i.test(opts.body)
  );
}

export function looksLikeHtml(body: string, contentType: string): boolean {
  if (contentType.includes("text/html")) return true;
  const trimmed = body.trimStart();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

export function looksLikeSpaShell(body: string): boolean {
  return (
    /id=["']root["']/i.test(body) &&
    (/OrangeCloud DocOps/i.test(body) || /\/assets\/index-/i.test(body))
  );
}
