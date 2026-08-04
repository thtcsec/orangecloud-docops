import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import {
  LoadingBlock,
  PageHeader,
  Panel,
  QueryErrorState,
  StatusBadge,
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
  note: string;
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

  return (
    <div>
      <PageHeader
        title={t.integrations.title}
        description={query.data!.note}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {query.data!.integrations.map((item) => (
          <Panel key={item.key} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink-900">{item.name}</h2>
                <p className="mt-1 text-sm text-ink-500">{item.description}</p>
              </div>
              <StatusBadge status={t.common.unavailable} />
            </div>
            <p className="mt-3 text-xs text-ink-500">
              {t.integrations.notConnected}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
