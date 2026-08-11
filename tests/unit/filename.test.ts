import { describe, expect, it } from "vitest";
import { getExtension, sanitizeFilename } from "../../src/worker/storage/filename";

describe("sanitizeFilename", () => {
  it("strips path segments and unsafe characters", () => {
    expect(sanitizeFilename("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFilename("Invoice 2026 #1 (final).pdf")).toBe(
      "Invoice_2026_1_final_.pdf",
    );
  });

  it("handles empty / dot names", () => {
    expect(sanitizeFilename("...")).toBe("document.bin");
    expect(sanitizeFilename("")).toBe("document.bin");
  });

  it("preserves extension for CJK-only basenames", () => {
    expect(sanitizeFilename("报告.pdf")).toBe("document.pdf");
    expect(sanitizeFilename("发票.XML")).toBe("document.xml");
    expect(sanitizeFilename("báo giá.pdf")).toMatch(/\.pdf$/);
  });
});

describe("getExtension", () => {
  it("returns lowercase extension", () => {
    expect(getExtension("a.PDF")).toBe("pdf");
    expect(getExtension("invoice.xml")).toBe("xml");
  });
});
