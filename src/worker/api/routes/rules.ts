import { Hono } from "hono";
import { PLANNED_RULES } from "@shared/domain";
import type { AppVariables } from "../middleware/context";
import { requireAuth } from "../middleware/auth";
import { ok } from "../response";

export const ruleRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

ruleRoutes.get("/rules", requireAuth, (c) => {
  return ok(c, {
    rules: PLANNED_RULES.map((rule) => ({
      ...rule,
      implemented: false,
      phase: "phase-2",
    })),
    note: "Phase 1 exposes a read-only catalogue. Deterministic evaluation starts in Phase 2.",
  });
});
