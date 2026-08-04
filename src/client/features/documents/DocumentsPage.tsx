import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@shared/domain";
import { apiGet, apiUpload } from "../../lib/api";
import { formatBytes, formatDate } from "../../lib/format";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (documentType) params.set("documentType", documentType);
    if (status) params.set("status", status);
    if (needsReview) params.set("needsReview", "true");
    if (search) params.set("search", search);
    if (uploadedFrom) params.set("uploadedFrom", new Date(uploadedFrom).toISOString());
    return params.toString();
  }, [documentType, status, needsReview, search, uploadedFrom]);

  const query = useQuery({
    queryKey: ["documents", queryString],
    queryFn: () =>
      apiGet<DocumentsResponse>(
        `/api/documents${queryString ? `?${queryString}` : ""}`,
      ),
  });

  return (
    <div>
      <PageHeader
        title={t.documents.title}
        description={t.documents.description}
        actions={
          <Link
            to="/documents/upload"
            className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white"
          >
            {t.common.upload}
          </Link>
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
        {query.isLoading ? <LoadingBlock label={t.common.loading} /> : null}
        {query.isError ? (
          <div className="p-4">
            <ErrorBanner message={(query.error as Error).message} />
          </div>
        ) : null}
        {query.data && query.data.items.length === 0 ? (
          <EmptyState
            title={t.documents.emptyTitle}
            description={t.documents.emptyBody}
            action={
              <Link to="/documents/upload" className="text-sm text-accent-600">
                {t.documents.submit}
              </Link>
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
                        to={`/cases/${doc.case_id}`}
                      >
                        {doc.case_id.slice(0, 12)}…
                      </Link>
                    ) : (
                      t.common.none
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/documents/${doc.id}`}
                      className="text-sm font-medium text-accent-600 hover:underline"
                    >
                      {t.common.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-ink-500">
              Showing {query.data.items.length} of {query.data.total}
            </div>
          </>
        ) : null}
      </Panel>
    </div>
  );
}

export function DocumentUploadPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [caseId, setCaseId] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    documentId: string;
    duplicateOf?: { displayName: string; documentId: string };
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError(t.documents.chooseFile);
      return;
    }
    const form = new FormData();
    form.set("file", file);
    if (documentType) form.set("documentType", documentType);
    if (caseId) form.set("caseId", caseId);
    setUploading(true);
    try {
      const data = await apiUpload<{
        documentId: string;
        duplicateOf?: { displayName: string; documentId: string };
      }>("/api/documents", form, setProgress);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <div>
      <PageHeader
        title={t.documents.uploadTitle}
        description={t.documents.uploadDescription}
      />
      <Panel className="max-w-2xl p-4">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed px-4 py-10 text-center ${
              dragging
                ? "border-accent-500 bg-accent-50"
                : "border-slate-300 bg-slate-50"
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
                accept=".pdf,.xml,application/pdf,application/xml,text/xml"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file ? (
              <p className="mt-3 text-sm text-ink-700">
                {t.documents.selected}: <span className="font-medium">{file.name}</span> (
                {formatBytes(file.size)})
              </p>
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
              placeholder="case_…"
            />
          </Field>

          {uploading ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-500">
                <span>{t.documents.uploading}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full bg-accent-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}
          {result?.duplicateOf ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t.documents.existingDocument}: {result.duplicateOf.displayName} (
              {result.duplicateOf.documentId}). {t.documents.duplicateWarn}
            </div>
          ) : null}
          {result ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {t.documents.uploadAccepted}{" "}
              <Link
                className="font-medium underline"
                to={`/documents/${result.documentId}`}
              >
                {t.documents.openDocument}
              </Link>
            </div>
          ) : null}

          <Button type="submit" disabled={uploading}>
            {uploading ? t.documents.uploading : t.documents.submit}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
