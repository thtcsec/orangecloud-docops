import { describe, expect, it } from "vitest";
import {
  assertTransition,
  buildIdempotencyKey,
  canTransition,
} from "../../src/worker/domain/documents/status-machine";

describe("document status machine", () => {
  it("allows known transitions and idempotent no-ops", () => {
    expect(canTransition("UPLOADED", "QUEUED")).toBe(true);
    expect(canTransition("QUEUED", "QUEUED")).toBe(true);
    expect(canTransition("APPROVED", "UPLOADING")).toBe(false);
  });

  it("throws on illegal transitions", () => {
    expect(() => assertTransition("EXPORTED", "FAILED")).toThrow();
  });

  it("builds stable idempotency keys", () => {
    expect(buildIdempotencyKey("ver_1", "process_document", "v1")).toBe(
      "ver_1:process_document:v1",
    );
  });
});
