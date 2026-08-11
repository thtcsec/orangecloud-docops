import { useQuery } from "@tanstack/react-query";
import { normalizeRole } from "@shared/domain";
import { apiGet } from "../../lib/api";
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
  const role = normalizeRole(user.role);
  const roleKey = role as keyof typeof t.roles.labels;
  const roleLabel = t.roles.labels[roleKey] || user.role;
  const roleSummary = t.roles.summaries[roleKey] || t.roles.summaries.viewer;
  const capabilities = t.roles.capabilities[roleKey] || t.roles.capabilities.viewer;
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

      <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
        <Panel>
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

        <Panel>
          <PanelHeader
            title={t.roles.capabilitiesTitle}
            subtitle={t.roles.capabilitiesSub}
          />
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {capabilities.map((item) => (
              <li key={item} className="px-4 py-3 text-sm text-ink-700">
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
