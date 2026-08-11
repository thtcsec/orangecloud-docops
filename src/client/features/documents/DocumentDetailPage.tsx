import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DOCUMENT_TYPES, roleCanUpload } from "@shared/domain";
import { apiFetchBlob, apiGet, apiPatchJson, apiPostJson } from "../../lib/api";
import { formatAuditAction } from "../../lib/audit-labels";
import {
  formatFieldLabel,
  formatRuleStatusLabel,
  isInformationalRuleStatus,
} from "../../lib/field-labels";
import { formatBytes, formatDate } from "../../lib/format";
import { appPath } from "../../lib/paths";
import { isDocumentInFlight, isRunInFlight } from "../../lib/processing";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  Button,
  DetailSkeleton,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  QueryErrorState,
  Select,
  SoftBanner,
  StatusBadge,
} from "../../components/ui";

import { useI18n } from "../../i18n";

type PreviewKind = "pdf" | "xml" | "unsupported";

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
  extractedFields: Array<{
    id: string;
    field_name: string;
    raw_value: string | null;
    normalized_value: string | null;
    value_type: string | null;
    confidence: number | null;
    source_kind: string | null;
    source_reference: string | null;
    provider: string | null;
  }>;

  ruleResults: Array<{
    id: string;
    rule_key: string;
    status: string;
    explanation: string | null;
    expected_value?: string | null;
    actual_value?: string | null;
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
  preview: { available: boolean; kind?: PreviewKind; message?: string };
};

function DocumentPreviewPanel({
  documentId,
  kind,
  available,
}: {
  documentId: string;
  kind: PreviewKind;
  available: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [xmlText, setXmlText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const auditedRef = useRef(false);

  useEffect(() => {
    if (!available || kind === "unsupported") return;
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { blob } = await apiFetchBlob(
          `/api/documents/${documentId}/download?disposition=inline`,
        );
        if (cancelled) return;
        if (kind === "xml") {
          const text = await blob.text();
          if (cancelled) return;
          setXmlText(text);
        } else {
          const url = URL.createObjectURL(blob);
          revoked = url;
          setBlobUrl(url);
        }
        if (!auditedRef.current) {
          auditedRef.current = true;
          try {
            await apiPostJson(`/api/documents/${documentId}/preview`, {});
            void qc.invalidateQueries({ queryKey: ["audit"] });
          } catch {
            // Preview still works if audit write fails.
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t.documentDetail.previewFailed,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [documentId, kind, available, qc, t.documentDetail.previewFailed]);

  if (!available || kind === "unsupported") {
    return (
      <div className="px-4 py-6 text-sm text-ink-500">
        {t.documentDetail.previewUnsupported}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-sm text-ink-500">
        {t.documentDetail.previewLoading}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (kind === "pdf" && blobUrl) {
    return (
      <iframe
        title={t.documentDetail.preview}
        src={blobUrl}
        className="h-[min(70vh,640px)] w-full border-0 bg-slate-100 dark:bg-slate-900"
      />
    );
  }

  if (kind === "xml" && xmlText != null) {
    return (
      <pre className="max-h-[min(70vh,640px)] overflow-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed text-slate-100">
        {xmlText}
      </pre>
    );
  }

  return (
    <div className="px-4 py-6 text-sm text-ink-500">
      {t.documentDetail.previewUnsupported}
    </div>
  );
}

type EditDocumentModalProps = {
  open: boolean;
  doc: {
    id: string;
    display_name: string;
    document_type: string;
    case_id: string | null;
  };
  onClose: () => void;
  onSuccess?: () => void;
};

function EditDocumentModal({ open, doc, onClose, onSuccess }: EditDocumentModalProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(doc.display_name);
  const [documentType, setDocumentType] = useState(doc.document_type);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiPatchJson<{ document: Detail["document"] }>(`/api/documents/${doc.id}`, {
        displayName: displayName.trim(),
        documentType,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["document", doc.id] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-ink-950">
            {t.documentDetail.editDocumentTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!displayName.trim()) return;
            mutation.mutate();
          }}
          className="mt-4 space-y-3"
        >
          {errorMsg && (
            <div className="rounded bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <Field label={t.documentDetail.displayName}>
            <Input
              value={displayName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDisplayName(e.target.value)
              }
              required
            />
          </Field>

          <Field label={t.documentDetail.documentType}>
            <Select
              value={documentType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setDocumentType(e.target.value)
              }
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? t.common.loading : t.documentDetail.saveChanges}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type EditFieldModalProps = {
  open: boolean;
  documentId: string;
  field: {
    id: string;
    field_name: string;
    normalized_value: string | null;
    raw_value: string | null;
  } | null;
  onClose: () => void;
  onSuccess?: () => void;
};

function EditFieldModal({
  open,
  documentId,
  field,
  onClose,
  onSuccess,
}: EditFieldModalProps) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [val, setVal] = useState(field?.normalized_value || field?.raw_value || "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (field) {
      setVal(field.normalized_value || field.raw_value || "");
    }
  }, [field]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!field) throw new Error("No field selected");
      return apiPatchJson(`/api/documents/${documentId}/fields/${field.id}`, {
        normalizedValue: val.trim() || null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["document", documentId] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  if (!open || !field) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-ink-950">
            {t.documentDetail.editFieldTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="mt-4 space-y-3"
        >
          {errorMsg && (
            <div className="rounded bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div>
            <span className="text-xs font-semibold text-ink-600">
              {formatFieldLabel(field.field_name, locale)} ({field.field_name})
            </span>
          </div>

          <Field label={t.documentDetail.fieldValue}>
            <Input
              value={val}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setVal(e.target.value)
              }
              placeholder="e.g. 15000000"
              autoFocus
            />
          </Field>


          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? t.common.loading : t.documentDetail.saveChanges}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DocumentDetailPage() {
  const { t, locale } = useI18n();
  const { documentId = "" } = useParams();
  const qc = useQueryClient();

  const [showEditDoc, setShowEditDoc] = useState(false);
  const [editingField, setEditingField] = useState<Detail["extractedFields"][0] | null>(null);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<{ user: { role: string } }>("/api/session"),
  });

  const canEdit = roleCanUpload(session.data?.user.role);

  const query = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => apiGet<Detail>(`/api/documents/${documentId}`),
    enabled: Boolean(documentId),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      if (isDocumentInFlight(data.document.status)) return 2000;
      if (data.processingRuns.some((run) => isRunInFlight(run.status))) {
        return 2000;
      }
      return false;
    },
  });

  const [confirmReprocess, setConfirmReprocess] = useState(false);
  const reprocess = useMutation({
    mutationFn: () =>
      apiPostJson(`/api/documents/${documentId}/reprocess`, {}),
    onSuccess: () => {
      setConfirmReprocess(false);
      void qc.invalidateQueries({ queryKey: ["document", documentId] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.nav.documents}
        backTo={appPath("/documents")}
        backLabel={t.common.backToDocuments}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }
  const data = query.data!;
  const busy = isDocumentInFlight(data.document.status);
  const status = data.document.status;
  const previewKind = data.preview.kind || "unsupported";


  return (
    <div className="space-y-4">
      <PageHeader
        title={data.document.display_name}
        description={`${data.document.document_type} · ${data.document.id}`}
        backTo={appPath("/documents")}
        backLabel={t.common.backToDocuments}
        actions={
          <>
            {canEdit && (
              <Button
                variant="secondary"
                onClick={() => setShowEditDoc(true)}
              >
                ✏️ {t.documentDetail.editDocument}
              </Button>
            )}
            <a
              href={`/api/documents/${documentId}/download`}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              {t.documentDetail.download}
            </a>
            <Button
              variant="secondary"
              onClick={() => setConfirmReprocess(true)}
              disabled={reprocess.isPending || busy}
            >
              {busy
                ? t.documentDetail.reprocessBusy
                : t.documentDetail.reprocess}
            </Button>
          </>
        }
      />
      {busy ? (
        <SoftBanner tone="ok">{t.common.processingLive}</SoftBanner>
      ) : null}
      {status === "NEEDS_REVIEW" ? (
        <SoftBanner tone="warn">
          {t.documentDetail.statusNeedsReview}{" "}
          <Link
            className="font-medium underline underline-offset-2"
            to={appPath("/review")}
          >
            {t.documentDetail.openReview}
          </Link>
        </SoftBanner>
      ) : null}
      {status === "APPROVED" ? (
        <SoftBanner tone="ok">{t.documentDetail.statusApproved}</SoftBanner>
      ) : null}
      {status === "EXPORTED" ? (
        <SoftBanner tone="ok">{t.documentDetail.statusExported}</SoftBanner>
      ) : null}
      {status === "REJECTED" ? (
        <SoftBanner tone="warn">{t.documentDetail.statusRejected}</SoftBanner>
      ) : null}
      {reprocess.isSuccess ? (
        <SoftBanner tone="ok">{t.documentDetail.reprocessQueued}</SoftBanner>
      ) : null}
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
                    to={appPath(`/cases/${data.document.case_id}`)}
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

        <Panel className="lg:col-span-2 overflow-hidden">
          <PanelHeader
            title={t.documentDetail.preview}
            subtitle={
              data.preview.available
                ? t.documentDetail.previewReady
                : t.documentDetail.previewUnsupported
            }
          />
          <DocumentPreviewPanel
            documentId={documentId}
            kind={previewKind}
            available={Boolean(data.preview.available)}
          />
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
                    ? ` · ${t.documentDetail.workflowId.replace("{id}", run.workflow_instance_id)}`
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
            subtitle={
              data.extractedFields.length > 0
                ? t.documentDetail.extractedSubReady
                : t.documentDetail.extractedSub
            }
          />
          <p className="border-b border-slate-100 px-4 py-2 text-xs leading-relaxed text-ink-500 dark:border-slate-800">
            {t.documentDetail.extractionHint}
          </p>
          {data.extractedFields.length === 0 ? (
            <EmptyState
              title={t.documentDetail.extractionUnavailableTitle}
              description={t.documentDetail.extractionUnavailableBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.extractedFields.map((field) => {
                const isOverridden = field.source_kind === "manual_override";
                return (
                  <li key={field.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-800">
                          {formatFieldLabel(field.field_name, locale)}
                        </span>
                        {isOverridden && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {t.documentDetail.manualOverrideBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {field.confidence != null ? (
                          <span className="text-xs text-ink-500">
                            {Math.round(field.confidence * 100)}%
                          </span>
                        ) : null}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditingField(field)}
                            className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
                          >
                            ✏️ {t.documentDetail.editField}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-base font-semibold text-ink-950">
                      {field.normalized_value || field.raw_value || t.common.none}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader
            title={t.documentDetail.ruleResults}
            subtitle={t.documentDetail.ruleResultsSub}
          />
          {data.ruleResults.length === 0 ? (
            <EmptyState
              title={t.documentDetail.noRulesTitle}
              description={t.documentDetail.noRulesBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {([...data.ruleResults].sort((a, b) => {
                const rank = (s: string) =>
                  isInformationalRuleStatus(s) ? 1 : 0;
                return rank(a.status) - rank(b.status);
              })).map((r) => {
                const copy =
                  t.rules.catalog[r.rule_key as keyof typeof t.rules.catalog];
                const deferred = isInformationalRuleStatus(r.status);
                return (
                  <li
                    key={r.id}
                    className={`px-4 py-3 text-sm ${deferred ? "opacity-80" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={r.status}
                        label={formatRuleStatusLabel(r.status, locale)}
                      />
                      <span className="font-medium text-ink-900">
                        {copy?.name || r.rule_key}
                      </span>
                    </div>
                    <p className="mt-1 text-ink-600">
                      {r.explanation || copy?.description || ""}
                    </p>
                    {deferred ? (
                      <p className="mt-1 text-xs text-ink-400">
                        {t.documentDetail.ruleDeferred}
                      </p>
                    ) : null}
                  </li>
                );
              })}
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
                    {d.comment || t.documentDetail.noComment} ·{" "}
                    {formatDate(d.created_at)}
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
                <div className="font-medium">
                  {formatAuditAction(e.action, locale)}
                </div>
                <div className="text-xs text-ink-500">
                  {e.actor_type} · {formatDate(e.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmReprocess}
        title={t.documentDetail.reprocessConfirmTitle}
        message={t.documentDetail.reprocessConfirmBody}
        confirmLabel={t.documentDetail.reprocess}
        cancelLabel={t.common.cancel}
        busy={reprocess.isPending}
        onCancel={() => setConfirmReprocess(false)}
        onConfirm={() => reprocess.mutate()}
      />

      {showEditDoc && (
        <EditDocumentModal
          open={showEditDoc}
          doc={data.document}
          onClose={() => setShowEditDoc(false)}
        />
      )}

      {editingField && (
        <EditFieldModal
          open={Boolean(editingField)}
          documentId={documentId}
          field={editingField}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  );
}

