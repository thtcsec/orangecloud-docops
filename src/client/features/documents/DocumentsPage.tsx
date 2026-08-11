import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@shared/domain";
import {
  ApiError,
  apiGet,
  apiUploadDocument,
  isAllowedUploadFile,
} from "../../lib/api";
import { roleCanUpload } from "@shared/domain";
import { formatBytes, formatDate } from "../../lib/format";
import { appPath } from "../../lib/paths";
import { documentsListNeedsPoll } from "../../lib/processing";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  SoftBanner,
  StatusBadge,
  TableRowsSkeleton,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type DocumentsResponse = {
  items: Array<{
    id: string;
    display_name: string;
    document_type: string;
    source: string;
    status: string;
    case_id: string | null;
    created_at: string;
    fileSize: number | null;
    latestProcessing: {
      id: string;
      status: string;
      errorCode: string | null;
      provider: string;
    } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

export function DocumentsPage() {
  const { t } = useI18n();
  const [documentType, setDocumentType] = useState("");
  const [status, setStatus] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadedFrom, setUploadedFrom] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () =>
      apiGet<{ user: { role: string } }>("/api/session"),
  });
  const canUpload = roleCanUpload(session.data?.user.role);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (documentType) params.set("documentType", documentType);
    if (status) params.set("status", status);
    if (needsReview) params.set("needsReview", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (uploadedFrom) params.set("uploadedFrom", new Date(uploadedFrom).toISOString());
    return params.toString();
  }, [documentType, status, needsReview, debouncedSearch, uploadedFrom]);

  const query = useQuery({
    queryKey: ["documents", queryString],
    queryFn: () =>
      apiGet<DocumentsResponse>(
        `/api/documents${queryString ? `?${queryString}` : ""}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data && documentsListNeedsPoll(q.state.data.items) ? 3000 : false,
  });

  return (
    <div>
      <PageHeader
        title={t.documents.title}
        description={t.documents.description}
        actions={
          canUpload ? (
            <Link
              to={appPath("/documents/upload")}
              className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white"
            >
              {t.common.upload}
            </Link>
          ) : undefined
        }
      />

      <Panel className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label={t.common.search}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.documents.searchPlaceholder}
            />
          </Field>
          <Field label={t.documents.type}>
            <Select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="">{t.documents.allTypes}</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.common.status}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t.documents.allStatuses}</option>
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.documents.uploadedFrom}>
            <Input
              type="date"
              value={uploadedFrom}
              onChange={(e) => setUploadedFrom(e.target.value)}
            />
          </Field>
          <Field label={t.dashboard.needsReview}>
            <label className="flex h-[38px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={needsReview}
                onChange={(e) => setNeedsReview(e.target.checked)}
              />
              {t.documents.needsReviewOnly}
            </label>
          </Field>
        </div>
      </Panel>

      <Panel>
        {query.isLoading ? <TableRowsSkeleton rows={6} /> : null}
        {!query.isLoading && query.isError ? (
          <div className="p-4">
            <ErrorBanner
              message={(query.error as Error).message || t.common.loadFailed}
              onRetry={() => void query.refetch()}
              retryLabel={t.common.retry}
            />
          </div>
        ) : null}
        {query.data && query.data.items.length === 0 ? (
          <EmptyState
            title={t.documents.emptyTitle}
            description={t.documents.emptyBody}
            action={
              canUpload ? (
                <Link to={appPath("/documents/upload")} className="text-sm text-accent-600">
                  {t.documents.submit}
                </Link>
              ) : undefined
            }
          />
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <>
            <DataTable
              headers={[
                t.documents.name,
                t.documents.type,
                t.documents.source,
                t.common.status,
                t.documents.size,
                t.documents.uploaded,
                t.documents.processing,
                t.documents.case,
                t.common.actions,
              ]}
            >
              {query.data.items.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {doc.display_name}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{doc.document_type}</td>
                  <td className="px-4 py-3 text-ink-700">{doc.source}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatBytes(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3">
                    {doc.latestProcessing ? (
                      <StatusBadge status={doc.latestProcessing.status} />
                    ) : (
                      t.common.none
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {doc.case_id ? (
                      <Link
                        className="text-accent-600 hover:underline"
                        to={appPath(`/cases/${doc.case_id}`)}
                      >
                        {doc.case_id.slice(0, 12)}…
                      </Link>
                    ) : (
                      t.common.none
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={appPath(`/documents/${doc.id}`)}
                      className="text-sm font-medium text-accent-600 hover:underline"
                    >
                      {t.common.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-ink-500">
              {t.common.showingOf
                .replace("{shown}", String(query.data.items.length))
                .replace("{total}", String(query.data.total))}
              {documentsListNeedsPoll(query.data.items) ? (
                <span className="ml-2 text-sky-700 dark:text-sky-400">
                  {t.common.processingLive}
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </Panel>
    </div>
  );
}

export function DocumentUploadPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [caseId, setCaseId] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    Array<{
      filename: string;
      ok: boolean;
      documentId?: string;
      message?: string;
      duplicateOf?: { displayName: string; documentId: string };
    }>
  >([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () =>
      apiGet<{ user: { role: string } }>("/api/session"),
  });
  const canUpload = roleCanUpload(session.data?.user.role);

  function takeFiles(list: FileList | File[] | null) {
    setError(null);
    if (!list || list.length === 0) return;
    const next: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      const check = isAllowedUploadFile(file);
      if (!check.ok) {
        rejected.push(file.name);
        continue;
      }
      next.push(file);
    }
    if (rejected.length > 0 && next.length === 0) {
      setError(t.documents.unsupportedType);
      return;
    }
    if (rejected.length > 0) {
      setError(
        t.documents.someUnsupported.replace("{names}", rejected.join(", ")),
      );
    }
    setFiles((prev) => [...prev, ...next]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults([]);
    if (files.length === 0) {
      setError(t.documents.chooseFile);
      return;
    }
    setUploading(true);
    const outcomes: typeof results = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setCurrentName(file.name);
        setProgress(Math.round((i / files.length) * 100));
        try {
          const data = await apiUploadDocument<{
            documentId: string;
            duplicateOf?: { displayName: string; documentId: string };
          }>(
            file,
            {
              documentType: documentType || undefined,
              caseId: caseId || undefined,
            },
            (pct) => {
              const base = (i / files.length) * 100;
              const slice = 100 / files.length;
              setProgress(Math.round(base + (pct / 100) * slice));
            },
          );
          outcomes.push({
            filename: file.name,
            ok: true,
            documentId: data.documentId,
            duplicateOf: data.duplicateOf,
          });
        } catch (err) {
          if (err instanceof ApiError && err.code === "ACCESS_REDIRECT") {
            return;
          }
          outcomes.push({
            filename: file.name,
            ok: false,
            message:
              err instanceof ApiError && err.code === "FORBIDDEN"
                ? t.documents.uploadForbidden
                : err instanceof Error
                  ? err.message
                  : t.common.actionFailed,
          });
        }
      }
      setProgress(100);
      setResults(outcomes);
      setFiles([]);
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["cases"] });
      if (caseId) {
        void qc.invalidateQueries({ queryKey: ["case", caseId] });
      }
    } finally {
      setUploading(false);
      setCurrentName(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    takeFiles(e.dataTransfer.files);
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <div>
      <PageHeader
        title={t.documents.uploadTitle}
        description={t.documents.uploadDescription}
        backTo={appPath("/documents")}
        backLabel={t.common.backToDocuments}
      />
      <Panel className="max-w-2xl p-4">
        {session.isSuccess && !canUpload ? (
          <div className="mb-4">
            <ErrorBanner message={t.documents.uploadForbidden} />
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
              dragging
                ? "border-accent-500 bg-accent-50 scale-[1.01]"
                : "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40"
            }`}
          >
            <p className="text-sm font-medium text-ink-900">
              {t.documents.drop}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {t.documents.maxSizeHint}
            </p>
            <div className="mt-4">
              <input
                type="file"
                multiple
                accept=".pdf,.PDF,.xml,.XML,application/pdf,application/xml,text/xml"
                onChange={(e) => {
                  takeFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 ? (
              <ul className="mt-3 space-y-1 text-left text-sm text-ink-700">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                    <span className="font-medium">{file.name}</span> (
                    {formatBytes(file.size)})
                  </li>
                ))}
              </ul>
            ) : null}
            {files.length > 0 ? (
              <button
                type="button"
                className="mt-3 text-xs font-medium text-accent-600 hover:underline"
                onClick={() => setFiles([])}
              >
                {t.documents.clearFiles}
              </button>
            ) : null}
          </div>

          <Field label={t.documents.documentType}>
            <Select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="">{t.documents.autoUnknown}</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t.documents.caseId} hint={t.documents.caseIdHint}>
            <Input
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder={t.documents.caseIdPlaceholder}
            />
          </Field>

          {uploading ? (
            <div className="space-y-3 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="truncate text-sm font-medium text-ink-800">
                    {currentName || t.documents.uploading}
                  </div>
                  <div className="h-2.5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-ink-500">
                  {progress}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-accent-500 transition-all duration-200"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
              <p className="text-xs text-ink-500">{t.documents.uploading}…</p>
            </div>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}
          {results.length > 0 ? (
            <div className="space-y-2">
              <SoftBanner tone={failCount === 0 ? "ok" : "warn"}>
                {t.documents.batchSummary
                  .replace("{ok}", String(okCount))
                  .replace("{fail}", String(failCount))}
              </SoftBanner>
              <ul className="space-y-2 text-sm">
                {results.map((item) => (
                  <li
                    key={`${item.filename}-${item.documentId || item.message}`}
                    className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"
                  >
                    <div className="font-medium">{item.filename}</div>
                    {item.ok && item.documentId ? (
                      <div className="mt-1 text-ink-500">
                        {t.documents.uploadAccepted}{" "}
                        <Link
                          className="font-medium text-accent-600 underline"
                          to={appPath(`/documents/${item.documentId}`)}
                        >
                          {t.documents.openDocument}
                        </Link>
                        {item.duplicateOf ? (
                          <span className="mt-1 block text-amber-800 dark:text-amber-200">
                            {t.documents.existingDocument}:{" "}
                            {item.duplicateOf.displayName}.{" "}
                            {t.documents.duplicateWarn}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1 text-red-700 dark:text-red-300">
                        {item.message || t.common.actionFailed}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={
              uploading ||
              files.length === 0 ||
              (session.isSuccess && !canUpload)
            }
          >
            {uploading
              ? t.documents.uploading
              : files.length > 1
                ? t.documents.submitMany.replace(
                    "{count}",
                    String(files.length),
                  )
                : t.documents.submit}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
