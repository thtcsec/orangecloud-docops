import { describe, expect, it } from "vitest";
import { isAccessChallenge, looksLikeSpaShell } from "../../src/shared/access-edge";
import { sanitizeFilename } from "../../src/shared/filename";

describe("isAccessChallenge", () => {
  it("detects Access WWW-Authenticate", () => {
    expect(
      isAccessChallenge({
        status: 401,
        body: "<html></html>",
        wwwAuthenticate:
          'Cloudflare-Access resource_metadata="https://example.com/.well-known/x"',
      }),
    ).toBe(true);
  });

  it("detects Access AJAX HTML 401/403 pages", () => {
    const body401 = `<html>
<head><title>401 Unauthorized</title></head>
<body><center><h1>401 Unauthorized</h1></center>
<hr><center>cloudflare</center></body></html>`;
    expect(isAccessChallenge({ status: 401, body: body401 })).toBe(true);

    const body403 = `<html>
<head><title>403 Forbidden</title></head>
<body><center><h1>403 Forbidden</h1></center>
<hr><center>cloudflare</center></body></html>`;
    expect(isAccessChallenge({ status: 403, body: body403 })).toBe(true);
  });

  it("detects 302 Found edge HTML", () => {
    const body = `<html><head><title>302 Found</title></head>
<body><center><h1>302 Found</h1></center><hr><center>cloudflare</center></body></html>`;
    expect(isAccessChallenge({ status: 302, body })).toBe(true);
  });

  it("does not treat SPA shell as Access", () => {
    const spa = `<!doctype html><html><head><title>OrangeCloud DocOps</title></head>
<body><div id="root"></div><script src="/assets/index-abc.js"></script></body></html>`;
    expect(isAccessChallenge({ status: 200, body: spa })).toBe(false);
    expect(looksLikeSpaShell(spa)).toBe(true);
  });

  it("detects Location to cloudflareaccess.com", () => {
    expect(
      isAccessChallenge({
        status: 302,
        body: "",
        location:
          "https://cloudspacevn.cloudflareaccess.com/cdn-cgi/access/login/docops.orangecloud.vn",
      }),
    ).toBe(true);
  });

  it("does not treat bare 3xx without Access Location as Access", () => {
    expect(
      isAccessChallenge({
        status: 302,
        body: "",
        location: null,
      }),
    ).toBe(false);
  });
});

describe("sanitizeFilename for upload multipart", () => {
  it("ASCII-sanitizes Vietnamese invoice names", () => {
    const safe = sanitizeFilename("báo giá bảo an-1607.pdf");
    expect(safe.endsWith(".pdf")).toBe(true);
    expect(safe).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect([...safe].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
  });
});
