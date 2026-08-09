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

type RulesResponse = {
  rules: Array<{
    key: string;
    name: string;
    description: string;
    implemented: boolean;
    phase: string;
  }>;
  note: string;
};

export function RulesPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["rules"],
    queryFn: () => apiGet<RulesResponse>("/api/rules"),
  });

  if (query.isLoading) return <LoadingBlock label={t.common.loading} />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.rules.title}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={t.rules.title}
        description={t.rules.description}
      />
      <Panel>
        <ul className="divide-y divide-slate-100">
          {query.data!.rules.map((rule) => (
            <li key={rule.key} className="px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-ink-900">{rule.name}</div>
                  <div className="font-mono text-xs text-ink-500">{rule.key}</div>
                </div>
                <StatusBadge
                  status={rule.implemented ? "implemented" : t.common.planned}
                />
              </div>
              <p className="mt-2 text-sm text-ink-500">{rule.description}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
