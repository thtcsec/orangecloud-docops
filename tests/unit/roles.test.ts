import { describe, expect, it } from "vitest";
import { normalizeRole, roleCanUpload, roleIsAdmin } from "../../src/shared/domain";

describe("role helpers", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeRole("Admin")).toBe("admin");
    expect(normalizeRole(" REVIEWER ")).toBe("reviewer");
    expect(normalizeRole("nope")).toBe("viewer");
  });

  it("gates upload for admin/reviewer", () => {
    expect(roleCanUpload("admin")).toBe(true);
    expect(roleCanUpload("Admin")).toBe(true);
    expect(roleCanUpload("reviewer")).toBe(true);
    expect(roleCanUpload("viewer")).toBe(false);
    expect(roleCanUpload(undefined)).toBe(false);
    expect(roleIsAdmin("admin")).toBe(true);
  });
});
