import { Navigate, Route, Routes } from "react-router-dom";
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
import { PrivacyPage } from "../features/privacy/PrivacyPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/upload" element={<DocumentUploadPage />} />
        <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
