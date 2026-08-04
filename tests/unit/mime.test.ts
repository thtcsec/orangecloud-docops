import { describe, expect, it } from "vitest";
import { validateMimeAndExtension } from "../../src/worker/storage/mime";

describe("validateMimeAndExtension", () => {
  it("accepts pdf and xml pairs", () => {
    expect(validateMimeAndExtension("a.pdf", "application/pdf").ok).toBe(true);
    expect(validateMimeAndExtension("a.xml", "application/xml").ok).toBe(true);
    expect(validateMimeAndExtension("a.xml", "text/xml").ok).toBe(true);
  });

  it("rejects mismatched mime", () => {
    const result = validateMimeAndExtension("a.pdf", "text/plain");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MIME_MISMATCH");
  });

  it("rejects unsupported types", () => {
    const result = validateMimeAndExtension("a.docx", "application/msword");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNSUPPORTED_FILE_TYPE");
  });
});
