import { describe, expect, it } from "vitest";
import { previewKindFromMimeAndName } from "../../src/shared/preview";

describe("previewKindFromMimeAndName", () => {
  it("detects pdf from mime or extension", () => {
    expect(previewKindFromMimeAndName("application/pdf", "a.bin")).toBe("pdf");
    expect(previewKindFromMimeAndName("", "quote.PDF")).toBe("pdf");
  });

  it("detects xml from mime or extension", () => {
    expect(previewKindFromMimeAndName("application/xml", "x")).toBe("xml");
    expect(previewKindFromMimeAndName("text/xml", "x")).toBe("xml");
    expect(previewKindFromMimeAndName("", "invoice.xml")).toBe("xml");
  });

  it("returns unsupported otherwise", () => {
    expect(previewKindFromMimeAndName("image/png", "a.png")).toBe(
      "unsupported",
    );
  });
});
