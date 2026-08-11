import { describe, expect, it } from "vitest";
import {
  formatAuditAction,
  formatAuditActor,
  formatAuditEntity,
} from "../../src/client/lib/audit-labels";

describe("audit labels", () => {
  it("maps known actions in Vietnamese", () => {
    expect(formatAuditAction("review.decision.created", "vi")).toBe(
      "Ghi nhận quyết định rà soát",
    );
    expect(formatAuditAction("export.completed", "vi")).toContain("ERP");
    expect(formatAuditAction("document.previewed", "vi")).toContain("xem trước");
  });

  it("falls back to raw action code", () => {
    expect(formatAuditAction("custom.unknown", "en")).toBe("custom.unknown");
  });

  it("formats actors and entities readably", () => {
    expect(
      formatAuditActor("system", "workflow", "en", "none"),
    ).toContain("System");
    expect(formatAuditEntity("document", "doc_abcdefghijklmnop", "vi")).toMatch(
      /Chứng từ/,
    );
  });

  it("maps user lifecycle actions", () => {
    expect(formatAuditAction("user.created", "en")).toBe("User created");
    expect(formatAuditAction("user.disabled", "vi")).toContain("khoá");
    expect(formatAuditEntity("user", "usr_abcdefghijklmnop", "en")).toMatch(
      /User/,
    );
  });
});
