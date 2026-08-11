import type { UserRole } from "@shared/domain";
import { normalizeRole } from "@shared/domain";
import {
  normalizeUserStatus,
  type UserStatus,
} from "../db/repositories/users";

export function parseBootstrapAdminEmails(
  bootstrapCsv: string | undefined,
): Set<string> {
  return new Set(
    (bootstrapCsv || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isBootstrapAdminEmail(
  email: string,
  bootstrapCsv: string | undefined,
): boolean {
  return parseBootstrapAdminEmails(bootstrapCsv).has(email.toLowerCase());
}

export type UserMutationGuard =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Protect last active admin and bootstrap Access admins from disable/demote.
 */
export function assertUserLifecycleChange(input: {
  target: {
    id: string;
    email: string;
    role: UserRole | string;
    status: UserStatus | string;
  };
  nextRole?: UserRole;
  nextStatus?: UserStatus;
  activeAdminCount: number;
  bootstrapEmails: string | undefined;
}): UserMutationGuard {
  const currentRole = normalizeRole(input.target.role);
  const currentStatus = normalizeUserStatus(input.target.status);
  const nextRole = input.nextRole ?? currentRole;
  const nextStatus = input.nextStatus ?? currentStatus;

  const wasActiveAdmin =
    currentRole === "admin" && currentStatus === "active";
  const remainsActiveAdmin =
    nextRole === "admin" && nextStatus === "active";

  if (
    wasActiveAdmin &&
    !remainsActiveAdmin &&
    input.activeAdminCount <= 1
  ) {
    return {
      ok: false,
      code: "LAST_ADMIN",
      message: "Cannot disable or demote the last active admin",
    };
  }

  if (
    nextStatus === "disabled" &&
    isBootstrapAdminEmail(input.target.email, input.bootstrapEmails)
  ) {
    return {
      ok: false,
      code: "BOOTSTRAP_ADMIN",
      message:
        "Cannot disable a bootstrap admin email listed in BOOTSTRAP_ADMIN_EMAILS",
    };
  }

  return { ok: true };
}
