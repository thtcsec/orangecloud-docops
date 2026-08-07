import { Hono } from "hono";
import { PLANNED_RULES } from "@shared/domain";
import type { AppVariables } from "../middleware/context";
import { requireAuth } from "../middleware/auth";
import { ok } from "../response";
import { IMPLEMENTED_RULE_KEYS } from "../../providers/interfaces";

export const ruleRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

const implemented = new Set<string>(IMPLEMENTED_RULE_KEYS);

ruleRoutes.get("/rules", requireAuth, (c) => {
  return ok(c, {
    rules: PLANNED_RULES.map((rule) => ({
      ...rule,
      implemented: implemented.has(rule.key),
      phase: implemented.has(rule.key) ? "phase-1.5" : "phase-2",
    })),
    note: "Phase 1.5 evaluates arithmetic, duplicates, supplier match, and XML core-field warnings. Remaining rules need linked case/contract data.",
  });
});
