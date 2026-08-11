import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { appPath } from "../../lib/paths";
import {
  DetailSkeleton,
  PageHeader,
  Panel,
  PanelHeader,
  QueryErrorState,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type Session = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    organizationId: string;
    authSource: string;
  };
};

export function ProfilePage() {
  const { t } = useI18n();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<Session>("/api/session"),
  });

  if (session.isLoading) return <DetailSkeleton />;
  if (session.isError) {
    return (
      <QueryErrorState
        title={t.roles.profileTitle}
        message={(session.error as Error).message || t.common.loadFailed}
        onRetry={() => void session.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  const user = session.data!.user;
  if (user.role !== "admin") {
    return <Navigate to={appPath("/dashboard")} replace />;
  }

  const roleKey = user.role as keyof typeof t.roles.labels;
  const roleLabel = t.roles.labels[roleKey] || user.role;
  const roleSummary = t.roles.summaries[roleKey] || t.roles.summaries.viewer;
  const authLabel =
    user.authSource === "cloudflare_access"
      ? t.roles.authAccess
      : t.roles.authLocal;

  return (
    <div>
      <PageHeader
        title={t.roles.profileTitle}
        description={t.roles.profileDescription}
      />

      <Panel className="max-w-xl">
        <PanelHeader title={user.displayName} subtitle={user.email} />
        <dl className="space-y-4 px-4 py-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t.roles.roleLabel}
            </dt>
            <dd className="mt-1 font-medium text-ink-900">{roleLabel}</dd>
            <dd className="mt-1 text-ink-500">{roleSummary}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t.roles.signInLabel}
            </dt>
            <dd className="mt-1 text-ink-800">{authLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t.roles.organizationLabel}
            </dt>
            <dd className="mt-1 font-mono text-xs text-ink-700">
              {user.organizationId}
            </dd>
          </div>
          <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-ink-500 dark:border-slate-800">
            {t.roles.manageHint}
          </p>
        </dl>
      </Panel>
    </div>
  );
}
