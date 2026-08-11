import { describe, expect, it } from "vitest";
import { assertUserLifecycleChange } from "../../src/worker/auth/user-guards";
import { normalizeUserStatus } from "../../src/worker/db/repositories/users";
import { HeuristicClassifier } from "../../src/worker/providers/interfaces";

describe("normalizeUserStatus", () => {
  it("defaults unknown values to active", () => {
    expect(normalizeUserStatus("active")).toBe("active");
    expect(normalizeUserStatus("disabled")).toBe("disabled");
    expect(normalizeUserStatus(undefined)).toBe("active");
    expect(normalizeUserStatus("nope")).toBe("active");
  });
});

describe("assertUserLifecycleChange", () => {
  const admin = {
    id: "usr_1",
    email: "admin@example.com",
    role: "admin" as const,
    status: "active" as const,
  };

  it("blocks demoting the last active admin", () => {
    const result = assertUserLifecycleChange({
      target: admin,
      nextRole: "viewer",
      activeAdminCount: 1,
      bootstrapEmails: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("LAST_ADMIN");
  });

  it("allows demoting when another admin remains", () => {
    const result = assertUserLifecycleChange({
      target: admin,
      nextRole: "reviewer",
      activeAdminCount: 2,
      bootstrapEmails: "",
    });
    expect(result).toEqual({ ok: true });
  });

  it("blocks disabling bootstrap admin emails", () => {
    const result = assertUserLifecycleChange({
      target: { ...admin, email: "boss@company.com" },
      nextStatus: "disabled",
      activeAdminCount: 3,
      bootstrapEmails: "boss@company.com, other@x.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BOOTSTRAP_ADMIN");
  });

  it("allows disabling a non-bootstrap viewer", () => {
    const result = assertUserLifecycleChange({
      target: {
        id: "usr_2",
        email: "viewer@example.com",
        role: "viewer",
        status: "active",
      },
      nextStatus: "disabled",
      activeAdminCount: 1,
      bootstrapEmails: "admin@example.com",
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("HeuristicClassifier quote hints", () => {
  const classifier = new HeuristicClassifier();

  it("marks bao-gia / quote filenames as likelyQuote but still invoice_pdf", async () => {
    const result = await classifier.classify({
      mimeType: "application/pdf",
      filename: "bao-gia-vendor-2026.pdf",
    });
    expect(result.documentType).toBe("invoice_pdf");
    expect(result.likelyQuote).toBe(true);
  });

  it("does not mark normal invoice PDFs", async () => {
    const result = await classifier.classify({
      mimeType: "application/pdf",
      filename: "hoa-don-GTGT-001.pdf",
    });
    expect(result.documentType).toBe("invoice_pdf");
    expect(result.likelyQuote).toBeUndefined();
  });
});
