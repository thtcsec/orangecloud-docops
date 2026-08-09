import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { appPath } from "../../lib/paths";
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
  PanelHeader,
  QueryErrorState,
  StatusBadge,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type DashboardData = {
  stats: {
    totalDocuments: number;
    processing: number;
    needsReview: number;
    failed: number;
    openCases: number;
  };
  recentAudit: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    actor_id: string | null;
    created_at: string;
  }>;
};

export function DashboardPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/api/dashboard"),
    refetchInterval: (q) =>
      (q.state.data?.stats.processing ?? 0) > 0 ? 5000 : false,
  });

  if (query.isLoading) return <LoadingBlock label={t.common.loading} />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.dashboard.title}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  const data = query.data!;
  const cards = [
    { label: t.dashboard.totalDocuments, value: data.stats.totalDocuments },
    { label: t.dashboard.processing, value: data.stats.processing },
    { label: t.dashboard.needsReview, value: data.stats.needsReview },
    { label: t.dashboard.failed, value: data.stats.failed },
    { label: t.dashboard.openCases, value: data.stats.openCases },
  ];

  const empty = data.stats.totalDocuments === 0;

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        description={t.dashboard.description}
        actions={
          <Link
            to={appPath("/documents/upload")}
            className="rounded-md bg-accent-600 px-3.5 py-2.5 text-[0.95rem] font-medium text-white transition hover:bg-accent-500"
          >
            {t.dashboard.upload}
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Panel key={card.label} className="px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-ink-950">
              {card.value}
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-6">
        <Panel>
          <PanelHeader
            title={t.dashboard.recentAudit}
            subtitle={t.dashboard.recentAuditSub}
          />
          {empty ? (
            <EmptyState
              title={t.dashboard.emptyTitle}
              description={t.dashboard.emptyBody}
              action={
                <Link
                  to={appPath("/documents/upload")}
                  className="text-base font-medium text-accent-600 hover:underline"
                >
                  {t.dashboard.goUpload}
                </Link>
              }
            />
          ) : data.recentAudit.length === 0 ? (
            <EmptyState
              title={t.dashboard.noAuditTitle}
              description={t.dashboard.noAuditBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentAudit.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-ink-900">{event.action}</div>
                    <div className="text-sm text-ink-500">
                      {event.entity_type}:{event.entity_id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-ink-500">
                    <StatusBadge
                      status={event.action.split(".").pop() || "event"}
                    />
                    <span>{formatDate(event.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
