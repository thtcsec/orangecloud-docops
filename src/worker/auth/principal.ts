import type { UserRole } from "@shared/domain";
import {
  normalizeRole,
  roleCanUpload,
  roleCanReview,
  roleIsAdmin,
} from "@shared/domain";

export type AppPrincipal = {
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  authSource: "cloudflare_access" | "local_dev" | "direct_session";
};


export function canUpload(role: UserRole): boolean {
  return roleCanUpload(role);
}

export function canReview(role: UserRole): boolean {
  return roleCanReview(role);
}

export function canViewAudit(role: UserRole): boolean {
  return roleIsAdmin(role);
}

export function canManageIntegrations(role: UserRole): boolean {
  return roleIsAdmin(role);
}

export function canManageUsers(role: UserRole): boolean {
  return roleIsAdmin(role);
}

export function canMutateCases(role: UserRole): boolean {
  return roleCanUpload(role);
}

export { normalizeRole };
