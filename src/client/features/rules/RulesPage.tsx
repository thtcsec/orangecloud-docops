import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import {
  CardsSkeleton,
  PageHeader,
  Panel,
  QueryErrorState,
  SoftBanner,
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

  if (query.isLoading) return <CardsSkeleton count={4} />;
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

  const catalog = t.rules.catalog;
  const activeCount = query.data!.rules.filter((r) => r.implemented).length;

  return (
    <div>
      <PageHeader
        title={t.rules.title}
        description={t.rules.description}
      />
      <div className="mb-4">
        <SoftBanner tone="info">
          {t.rules.note
            .replace("{active}", String(activeCount))
            .replace("{total}", String(query.data!.rules.length))}
        </SoftBanner>
      </div>
      <Panel>
        <ul className="divide-y divide-slate-100">
          {query.data!.rules.map((rule) => {
            const copy = catalog[rule.key as keyof typeof catalog];
            return (
              <li key={rule.key} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink-900">
                      {copy?.name || rule.name}
                    </div>
                    <div className="font-mono text-xs text-ink-500">
                      {rule.key}
                    </div>
                  </div>
                  <StatusBadge
                    status={rule.implemented ? "ACTIVE" : "PLANNED"}
                    label={
                      rule.implemented ? t.rules.active : t.rules.planned
                    }
                  />
                </div>
                <p className="mt-2 text-sm text-ink-500">
                  {copy?.description || rule.description}
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
