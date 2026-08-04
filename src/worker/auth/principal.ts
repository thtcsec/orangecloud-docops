import type { UserRole } from "@shared/domain";

export type AppPrincipal = {
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  authSource: "cloudflare_access" | "local_dev";
};

export function canUpload(role: UserRole): boolean {
  return role === "admin" || role === "reviewer";
}

export function canReview(role: UserRole): boolean {
  return role === "admin" || role === "reviewer";
}

export function canViewAudit(role: UserRole): boolean {
  return role === "admin";
}

export function canManageIntegrations(role: UserRole): boolean {
  return role === "admin";
}

export function canMutateCases(role: UserRole): boolean {
  return role === "admin" || role === "reviewer";
}
