import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { LandingPage } from "../features/landing/LandingPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { DocumentDetailPage } from "../features/documents/DocumentDetailPage";
import {
  DocumentsPage,
  DocumentUploadPage,
} from "../features/documents/DocumentsPage";
import { CaseDetailPage, CasesPage } from "../features/cases/CasesPage";
import { ReviewPage } from "../features/review/ReviewPage";
import { RulesPage } from "../features/rules/RulesPage";
import { AuditPage } from "../features/audit/AuditPage";
import { IntegrationsPage } from "../features/integrations/IntegrationsPage";
import { ProfilePage } from "../features/settings/ProfilePage";
import { PrivacyPage } from "../features/privacy/PrivacyPage";
import { useI18n } from "../i18n";
import { APP_BASE, LEGACY_APP_SEGMENTS } from "../lib/paths";

/** Full browser navigation so Cloudflare Access can intercept /app/*. */
function LegacyAppRedirect() {
  const { t } = useI18n();
  const { pathname, search, hash } = useLocation();
  const target = `${APP_BASE}${pathname}${search}${hash}`;

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <p className="p-6 text-sm text-ink-500">
      {t.common.loading} {target}
    </p>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route path={APP_BASE} element={<AppShell />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/upload" element={<DocumentUploadPage />} />
        <Route path="documents/:documentId" element={<DocumentDetailPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="cases/:caseId" element={<CaseDetailPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings/integrations" element={<IntegrationsPage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
      </Route>

      {LEGACY_APP_SEGMENTS.map((segment) => (
        <Route key={segment} path={`/${segment}/*`} element={<LegacyAppRedirect />} />
      ))}

      {/* Never soft-send unknown paths that look like API into the marketing home. */}
      <Route path="/api/*" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
