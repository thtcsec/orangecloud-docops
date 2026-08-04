import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/worker/storage/hash";

describe("sha256Hex", () => {
  it("produces stable hashes for identical content", async () => {
    const a = await sha256Hex(new TextEncoder().encode("synthetic-fixture"));
    const b = await sha256Hex(new TextEncoder().encode("synthetic-fixture"));
    const c = await sha256Hex(new TextEncoder().encode("different"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});
