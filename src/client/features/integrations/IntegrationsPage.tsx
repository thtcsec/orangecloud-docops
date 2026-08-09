import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import {
  LoadingBlock,
  PageHeader,
  Panel,
  QueryErrorState,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type IntegrationsResponse = {
  integrations: Array<{
    key: string;
    name: string;
    description: string;
    status: string;
    connected: boolean;
    configurable: boolean;
  }>;
};

export function IntegrationsPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiGet<IntegrationsResponse>("/api/integrations"),
  });

  if (query.isLoading) return <LoadingBlock label={t.common.loading} />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.integrations.title}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  const catalog = t.integrations.catalog;

  return (
    <div>
      <PageHeader
        title={t.integrations.title}
        description={t.integrations.description}
      />

      <Panel className="mb-4 px-4 py-3 text-sm text-ink-500">
        {t.integrations.roadmapNote}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        {query.data!.integrations.map((item) => {
          const copy = catalog[item.key as keyof typeof catalog];
          return (
            <Panel key={item.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink-900">
                    {copy?.name || item.name}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">
                    {copy?.description || item.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-ink-600 dark:bg-slate-800 dark:text-slate-300">
                  {t.integrations.planned}
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-500">
                {t.integrations.availability}
              </p>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
