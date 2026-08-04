import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPostJson } from "../../lib/api";
import { formatBytes, formatDate } from "../../lib/format";
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Panel,
  PanelHeader,
  QueryErrorState,
  StatusBadge,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type Detail = {
  document: {
    id: string;
    display_name: string;
    document_type: string;
    source: string;
    status: string;
    case_id: string | null;
    created_at: string;
    updated_at: string;
  };
  versions: Array<{
    id: string;
    version_number: number;
    original_filename: string;
    mime_type: string;
    file_size: number;
    sha256: string;
    etag: string | null;
    created_at: string;
  }>;
  processingRuns: Array<{
    id: string;
    status: string;
    provider: string;
    attempt: number;
    error_code: string | null;
    error_message: string | null;
    workflow_instance_id: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
  extractedFields: Array<unknown>;
  ruleResults: Array<{
    id: string;
    rule_key: string;
    status: string;
    explanation: string | null;
  }>;
  reviewDecisions: Array<{
    id: string;
    decision: string;
    comment: string | null;
    created_at: string;
  }>;
  auditEvents: Array<{
    id: string;
    action: string;
    actor_type: string;
    created_at: string;
  }>;
  preview: { available: boolean; message: string };
};

export function DocumentDetailPage() {
  const { t } = useI18n();
  const { documentId = "" } = useParams();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => apiGet<Detail>(`/api/documents/${documentId}`),
    enabled: Boolean(documentId),
  });

  const reprocess = useMutation({
    mutationFn: () =>
      apiPostJson(`/api/documents/${documentId}/reprocess`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document", documentId] }),
  });

  if (query.isLoading) return <LoadingBlock label={t.common.loading} />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.nav.documents}
        backTo="/documents"
        backLabel={t.common.backToDocuments}
        message={
          (query.error as Error).message || t.common.loadFailed
        }
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }
  const data = query.data!;

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.document.display_name}
        description={`${data.document.document_type} · ${data.document.id}`}
        backTo="/documents"
        backLabel={t.common.backToDocuments}
        actions={
          <>
            <a
              href={`/api/documents/${documentId}/download`}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              {t.documentDetail.download}
            </a>
            <Button
              variant="secondary"
              onClick={() => reprocess.mutate()}
              disabled={reprocess.isPending}
            >
              {t.documentDetail.reprocess}
            </Button>
          </>
        }
      />
      {reprocess.isError ? (
        <ErrorBanner
          message={
            (reprocess.error as Error).message ||
            t.documentDetail.reprocessFailed
          }
          onRetry={() => reprocess.mutate()}
          retryLabel={t.common.retry}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelHeader title={t.documentDetail.metadata} />
          <dl className="space-y-2 px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t.common.status}</dt>
              <dd>
                <StatusBadge status={data.document.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t.documentDetail.source}</dt>
              <dd>{data.document.source}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t.documentDetail.uploaded}</dt>
              <dd>{formatDate(data.document.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-500">{t.documentDetail.case}</dt>
              <dd>
                {data.document.case_id ? (
                  <Link
                    className="text-accent-600 hover:underline"
                    to={`/cases/${data.document.case_id}`}
                  >
                    {t.documentDetail.openCase}
                  </Link>
                ) : (
                  t.common.none
                )}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title={t.documentDetail.preview} subtitle={t.documentDetail.previewSub} />
          <div className="px-4 py-6 text-sm text-ink-500">
            {data.preview.message}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title={t.documentDetail.versions} />
        <ul className="divide-y divide-slate-100">
          {data.versions.map((v) => (
            <li key={v.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">
                  v{v.version_number} · {v.original_filename}
                </div>
                <div className="text-xs text-ink-500">
                  {formatBytes(v.file_size)} · {formatDate(v.created_at)}
                </div>
              </div>
              <div className="mt-1 font-mono text-xs text-ink-500">
                sha256:{v.sha256} · etag:{v.etag || t.common.none}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title={t.documentDetail.timeline} />
        {data.processingRuns.length === 0 ? (
          <EmptyState
            title={t.documentDetail.noRunsTitle}
            description={t.documentDetail.noRunsBody}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.processingRuns.map((run) => (
              <li key={run.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={run.status} />
                  <span className="font-medium">{run.provider}</span>
                  <span className="text-xs text-ink-500">
                    {t.documentDetail.attempt} {run.attempt}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  {formatDate(run.created_at)}
                  {run.workflow_instance_id
                    ? ` · workflow ${run.workflow_instance_id}`
                    : ""}
                  {run.error_code ? ` · ${run.error_code}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title={t.documentDetail.extracted}
            subtitle={t.documentDetail.extractedSub}
          />
          {data.extractedFields.length === 0 ? (
            <EmptyState
              title={t.documentDetail.extractionUnavailableTitle}
              description={t.documentDetail.extractionUnavailableBody}
            />
          ) : null}
        </Panel>
        <Panel>
          <PanelHeader title={t.documentDetail.ruleResults} />
          {data.ruleResults.length === 0 ? (
            <EmptyState
              title={t.documentDetail.noRulesTitle}
              description={t.documentDetail.noRulesBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.ruleResults.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="font-medium">{r.rule_key}</span>
                  </div>
                  <p className="mt-1 text-ink-500">{r.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t.documentDetail.reviewHistory} />
          {data.reviewDecisions.length === 0 ? (
            <EmptyState
              title={t.documentDetail.noDecisionsTitle}
              description={t.documentDetail.noDecisionsBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.reviewDecisions.map((d) => (
                <li key={d.id} className="px-4 py-3 text-sm">
                  <StatusBadge status={d.decision} />
                  <div className="mt-1 text-ink-500">
                    {d.comment || t.documentDetail.noComment} · {formatDate(d.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title={t.documentDetail.auditEvents} />
          <ul className="divide-y divide-slate-100">
            {data.auditEvents.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{e.action}</div>
                <div className="text-xs text-ink-500">
                  {e.actor_type} · {formatDate(e.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
