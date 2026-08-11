import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/worker/auth/password";
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../../src/worker/auth/session";

describe("Native Web Crypto PBKDF2 Password Hashing", () => {
  it("generates valid serialized hash and verifies correct password", async () => {
    const raw = "SecureP@ssw0rd2026!";
    const hash = await hashPassword(raw);

    expect(hash).toMatch(/^pbkdf2:sha256:100000:[0-9a-f]{32}:[0-9a-f]{64}$/);

    const match = await verifyPassword(raw, hash);
    expect(match).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const raw = "SecureP@ssw0rd2026!";
    const hash = await hashPassword(raw);

    const match = await verifyPassword("WrongPassword123", hash);
    expect(match).toBe(false);
  });

  it("handles corrupted or empty hash gracefully", async () => {
    expect(await verifyPassword("password", "")).toBe(false);
    expect(await verifyPassword("password", null as never)).toBe(false);
    expect(await verifyPassword("password", "invalid_hash_string")).toBe(false);
    expect(await verifyPassword("password", "pbkdf2:sha256:invalid")).toBe(false);
  });
});

describe("Direct Auth Session Tokens and Cookies", () => {
  const fakeEnv = {
    JWT_SECRET: "test-jwt-secret-for-unit-testing-32-chars-long",
    ENVIRONMENT: "local",
  } as unknown as Env;

  it("signs and verifies direct session JWT token", async () => {
    const payload = {
      userId: "usr_abc123",
      organizationId: "org_test",
      email: "accountant@company.vn",
      displayName: "Nguyễn Văn Kế Toán",
      role: "reviewer" as const,
    };

    const token = await createSessionToken(payload, fakeEnv);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = await verifySessionToken(token, fakeEnv);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("usr_abc123");
    expect(verified?.email).toBe("accountant@company.vn");
    expect(verified?.role).toBe("reviewer");
    expect(verified?.displayName).toBe("Nguyễn Văn Kế Toán");
  });

  it("rejects token with invalid secret", async () => {
    const payload = {
      userId: "usr_abc123",
      organizationId: "org_test",
      email: "accountant@company.vn",
      displayName: "Nguyễn Văn Kế Toán",
      role: "reviewer" as const,
    };

    const token = await createSessionToken(payload, fakeEnv);

    const otherEnv = {
      JWT_SECRET: "different-secret-key-32-chars-long!!",
      ENVIRONMENT: "local",
    } as unknown as Env;

    const verified = await verifySessionToken(token, otherEnv);
    expect(verified).toBeNull();
  });

  it("builds correct session cookie headers", () => {
    const header = buildSessionCookieHeader("sample_jwt_token", fakeEnv);
    expect(header).toContain(`${SESSION_COOKIE_NAME}=sample_jwt_token`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Lax");

    const clearHeader = buildClearSessionCookieHeader(fakeEnv);
    expect(clearHeader).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(clearHeader).toContain("Max-Age=0");
  });
});
