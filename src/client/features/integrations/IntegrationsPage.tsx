import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { roleIsAdmin } from "@shared/domain";
import { apiGet, apiPostJson, apiPutJson } from "../../lib/api";
import {
  Button,
  CardsSkeleton,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Panel,
  QueryErrorState,
  SoftBanner,
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
    webhookUrlMasked?: string | null;
  }>;
};

export function IntegrationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<{ user: { role: string } }>("/api/session"),
  });
  const isAdmin = roleIsAdmin(session.data?.user.role);

  const query = useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiGet<IntegrationsResponse>("/api/integrations"),
  });

  const erp = query.data?.integrations.find((i) => i.key === "erp_webhook");

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [erp?.webhookUrlMasked, erp?.connected]);

  const save = useMutation({
    mutationFn: (url: string) =>
      apiPutJson<{ connected: boolean; webhookUrlMasked: string | null }>(
        "/api/integrations/erp_webhook",
        { webhookUrl: url },
      ),
    onSuccess: (data) => {
      setError(null);
      setMessage(
        data.connected
          ? t.integrations.erpSaved
          : t.integrations.erpCleared,
      );
      setWebhookUrl("");
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  const test = useMutation({
    mutationFn: () =>
      apiPostJson<{ tested: boolean; status: number }>(
        "/api/integrations/erp_webhook/test",
        {},
      ),
    onSuccess: () => {
      setError(null);
      setMessage(t.integrations.erpTestOk);
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t.integrations.erpTestFailed);
    },
  });

  if (query.isLoading) return <CardsSkeleton count={4} />;
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
          const isErp = item.key === "erp_webhook";
          const badge = item.connected
            ? t.integrations.connected
            : item.configurable
              ? t.integrations.available
              : t.integrations.planned;

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
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                    item.connected
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : "bg-slate-100 text-ink-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {badge}
                </span>
              </div>

              {isErp ? (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-xs text-ink-500">
                    {item.connected && item.webhookUrlMasked
                      ? t.integrations.erpConfigured.replace(
                          "{url}",
                          item.webhookUrlMasked,
                        )
                      : t.integrations.erpNotConfigured}
                  </p>
                  {isAdmin ? (
                    <>
                      <Field label={t.integrations.erpUrlLabel}>
                        <Input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://erp.example.com/hooks/docops"
                          autoComplete="off"
                        />
                      </Field>
                      {message ? (
                        <SoftBanner tone="ok">{message}</SoftBanner>
                      ) : null}
                      {error ? <ErrorBanner message={error} /> : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => save.mutate(webhookUrl)}
                          disabled={save.isPending || !webhookUrl.trim()}
                        >
                          {t.integrations.erpSave}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => test.mutate()}
                          disabled={
                            test.isPending || !item.connected || save.isPending
                          }
                        >
                          {t.integrations.erpTest}
                        </Button>
                        {item.connected ? (
                          <Button
                            variant="secondary"
                            onClick={() => save.mutate("")}
                            disabled={save.isPending}
                          >
                            {t.integrations.erpClear}
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-ink-500">
                      {t.integrations.adminOnly}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-500">
                  {t.integrations.availability}
                </p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
