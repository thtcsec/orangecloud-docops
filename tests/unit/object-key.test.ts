import { describe, expect, it } from "vitest";
import { buildR2ObjectKey } from "../../src/worker/storage/object-key";

describe("buildR2ObjectKey", () => {
  it("builds structured keys", () => {
    const key = buildR2ObjectKey({
      environment: "staging",
      organizationId: "org_1",
      documentId: "doc_1",
      versionId: "ver_1",
      filename: "My Invoice.pdf",
    });
    expect(key).toBe(
      "staging/org_1/doc_1/ver_1/original/My_Invoice.pdf",
    );
  });
});
