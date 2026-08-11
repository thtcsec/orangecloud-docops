import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { RELATIONSHIP_TYPES, roleCanUpload } from "@shared/domain";
import { apiGet, apiPatchJson, apiPostJson } from "../../lib/api";
import { formatAuditAction } from "../../lib/audit-labels";
import { formatDate } from "../../lib/format";
import { appPath } from "../../lib/paths";
import { DocumentPickerModal } from "../../components/DocumentPickerModal";
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
  SoftBanner,
  StatusBadge,
  DataTable,
  TablePageSkeleton,
  Select,
} from "../../components/ui";
import { useI18n } from "../../i18n";


type CasesResponse = {
  items: Array<{
    id: string;
    reference: string;
    vendor_name: string | null;
    vendor_tax_id: string | null;
    status: string;
    exceptions: number;
    linkedDocuments: number;
    relationships: Array<{
      documentId: string;
      relationshipType: string;
      displayName: string;
      status: string;
    }>;
    updated_at: string;
  }>;
  total: number;
};

type CaseDetail = {
  case: {
    id: string;
    reference: string;
    vendor_name: string | null;
    vendor_tax_id: string | null;
    status: string;
    created_at: string;
  };
  documents: Array<{
    relationship_type: string;
    document: {
      id: string;
      display_name: string;
      document_type: string;
      status: string;
    };
  }>;
  validationSummary: {
    total: number;
    fail: number;
    warning: number;
    pass: number;
    notEvaluated: number;
  };
  exceptions: Array<{
    id: string;
    rule_key: string;
    status: string;
    explanation: string | null;
    expected_value: string | null;
    actual_value: string | null;
  }>;
  reviewTasks: Array<{
    id: string;
    status: string;
    reason: string;
  }>;
  auditEvents: Array<{
    id: string;
    action: string;
    created_at: string;
  }>;
};

export function CasesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorTaxId, setVendorTaxId] = useState("");
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiGet<CasesResponse>("/api/cases"),
  });

  const createCase = useMutation({
    mutationFn: () =>
      apiPostJson<{ case: { id: string; reference: string } }>("/api/cases", {
        reference: reference.trim(),
        vendorName: vendorName.trim() || undefined,
        vendorTaxId: vendorTaxId.trim() || undefined,
      }),
    onSuccess: (data) => {
      setCreatedCaseId(data.case.id);
      setReference("");
      setVendorName("");
      setVendorTaxId("");
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });

  if (query.isLoading) return <TablePageSkeleton rows={5} />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.cases.title}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.cases.title}
        description={t.cases.description}
      />

      <Panel className="max-w-2xl p-4">
        <PanelHeader
          title={t.cases.createTitle}
          subtitle={t.cases.createHint}
        />
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reference.trim()) return;
            createCase.mutate();
          }}
        >
          <Field label={t.cases.reference}>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t.cases.referencePlaceholder}
              required
            />
          </Field>
          <Field label={t.cases.vendor} hint={t.common.optional}>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </Field>
          <Field label={t.cases.vendorTaxId} hint={t.common.optional}>
            <Input
              value={vendorTaxId}
              onChange={(e) => setVendorTaxId(e.target.value)}
            />
          </Field>
          {createCase.isError ? (
            <ErrorBanner
              message={
                (createCase.error as Error).message || t.common.actionFailed
              }
            />
          ) : null}
          {createdCaseId ? (
            <SoftBanner tone="ok">
              {t.cases.createSuccess}{" "}
              <Link className="font-medium text-accent-700" to={appPath(`/cases/${createdCaseId}`)}>
                {createdCaseId}
              </Link>
              . {t.cases.createUploadHint}
            </SoftBanner>
          ) : null}
          <Button type="submit" disabled={createCase.isPending || !reference.trim()}>
            {createCase.isPending ? t.common.loading : t.cases.createAction}
          </Button>
        </form>
      </Panel>

      <Panel>
        {query.data!.items.length === 0 ? (
          <EmptyState
            title={t.cases.emptyTitle}
            description={t.cases.emptyBody}
          />
        ) : (
          <DataTable
            headers={[
              t.cases.reference,
              t.cases.vendor,
              t.common.status,
              t.cases.contractValue,
              t.cases.poValue,
              t.cases.invoiceTotal,
              t.cases.exceptions,
              t.cases.reviewer,
              t.cases.updated,
              "",
            ]}
          >
            {query.data!.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium">{item.reference}</td>
                <td className="px-4 py-3">
                  <div>{item.vendor_name || t.common.none}</div>
                  <div className="font-mono text-xs text-ink-500">
                    {item.vendor_tax_id || ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-ink-500" title={t.cases.needsPhase2}>
                  {t.common.none}
                </td>
                <td className="px-4 py-3 text-ink-500" title={t.cases.needsPhase2}>
                  {t.common.none}
                </td>
                <td className="px-4 py-3 text-ink-500" title={t.cases.needsPhase2}>
                  {t.common.none}
                </td>
                <td className="px-4 py-3 tabular-nums">{item.exceptions}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={item.exceptions > 0 ? "NEEDS_REVIEW" : item.status}
                  />
                </td>
                <td className="px-4 py-3">{formatDate(item.updated_at)}</td>
                <td className="px-4 py-3">
                  <Link
                    className="text-sm font-medium text-accent-600"
                    to={appPath(`/cases/${item.id}`)}
                  >
                    {t.common.open}
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}

type EditCaseModalProps = {
  open: boolean;
  caseItem: {
    id: string;
    reference: string;
    vendor_name: string | null;
    vendor_tax_id: string | null;
    status: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
};

function EditCaseModal({ open, caseItem, onClose, onSuccess }: EditCaseModalProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [reference, setReference] = useState(caseItem.reference);
  const [vendorName, setVendorName] = useState(caseItem.vendor_name || "");
  const [vendorTaxId, setVendorTaxId] = useState(caseItem.vendor_tax_id || "");
  const [status, setStatus] = useState(caseItem.status);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiPatchJson<{ case: CaseDetail["case"] }>(`/api/cases/${caseItem.id}`, {
        reference: reference.trim(),
        vendorName: vendorName.trim() || null,
        vendorTaxId: vendorTaxId.trim() || null,
        status,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case", caseItem.id] });
      void qc.invalidateQueries({ queryKey: ["cases"] });
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
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-ink-950">
            {t.cases.editCaseTitle}
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
            if (!reference.trim()) return;
            mutation.mutate();
          }}
          className="mt-4 space-y-3"
        >
          {errorMsg && (
            <div className="rounded bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <Field label={t.cases.reference}>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
          </Field>

          <Field label={t.cases.vendor} hint={t.common.optional}>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </Field>

          <Field label={t.cases.vendorTaxId} hint={t.common.optional}>
            <Input
              value={vendorTaxId}
              onChange={(e) => setVendorTaxId(e.target.value)}
            />
          </Field>

          <Field label={t.cases.caseStatus}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">open</option>
              <option value="in_review">in_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="exported">exported</option>
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
              {mutation.isPending ? t.common.loading : t.common.confirm}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CaseDetailPage() {
  const { t, locale } = useI18n();
  const { caseId = "" } = useParams();
  const qc = useQueryClient();
  const [linkDocumentId, setLinkDocumentId] = useState("");
  const [relationshipType, setRelationshipType] = useState<string>("invoice");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkOk, setLinkOk] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showEditCase, setShowEditCase] = useState(false);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<{ user: { role: string } }>("/api/session"),
  });

  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => apiGet<CaseDetail>(`/api/cases/${caseId}`),
    enabled: Boolean(caseId),
  });

  const canEdit = roleCanUpload(session.data?.user.role);

  const linkDoc = useMutation({
    mutationFn: () =>
      apiPostJson(`/api/cases/${caseId}/documents`, {
        documentId: linkDocumentId.trim(),
        relationshipType,
      }),
    onSuccess: () => {
      setLinkError(null);
      setLinkOk(true);
      setLinkDocumentId("");
      void qc.invalidateQueries({ queryKey: ["case", caseId] });
      void qc.invalidateQueries({ queryKey: ["cases"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (err) => {
      setLinkOk(false);
      setLinkError(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.cases.title}
        backTo={appPath("/cases")}
        backLabel={t.common.backToCases}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }
  const data = query.data!;

  const validationLabels = [
    { label: t.cases.total, value: data.validationSummary.total },
    { label: t.cases.pass, value: data.validationSummary.pass },
    { label: t.cases.warning, value: data.validationSummary.warning },
    { label: t.cases.fail, value: data.validationSummary.fail },
    { label: t.cases.notEvaluated, value: data.validationSummary.notEvaluated },
  ];

  const relLabels = t.cases.relationships;

  // Breakdown of linked document types
  const contractsCount = data.documents.filter(
    (d) => d.relationship_type === "contract",
  ).length;
  const posCount = data.documents.filter(
    (d) => d.relationship_type === "purchase_order",
  ).length;
  const invoicesCount = data.documents.filter(
    (d) => d.relationship_type === "invoice",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={data.case.reference}
          description={t.cases.vendorLine
            .replace("{name}", data.case.vendor_name || t.common.none)
            .replace("{taxId}", data.case.vendor_tax_id || t.common.none)}
          backTo={appPath("/cases")}
          backLabel={t.common.backToCases}
        />
        {canEdit && (
          <Button
            variant="secondary"
            onClick={() => setShowEditCase(true)}
            className="self-start sm:self-center"
          >
            ✏️ {t.cases.editCase}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader title={t.cases.caseStatus} />
          <div className="space-y-2 px-4 py-3 text-sm">
            <StatusBadge status={data.case.status} />
            <div className="text-ink-500">
              {t.cases.created} {formatDate(data.case.created_at)}
            </div>
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title={t.cases.validation} />
          <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-5">
            {validationLabels.map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs uppercase text-ink-500">{label}</div>
                <div className="text-xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* C2P Financial & Document Structure Summary */}
      <Panel className="p-4">
        <PanelHeader
          title={t.cases.c2pFinancialTitle}
          subtitle={t.cases.c2pDocumentsCount.replace(
            "{count}",
            String(data.documents.length),
          )}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <div className="text-xs text-ink-500">{relLabels.contract}</div>
            <div className="mt-1 text-lg font-semibold text-ink-950">
              {contractsCount}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <div className="text-xs text-ink-500">{relLabels.purchase_order}</div>
            <div className="mt-1 text-lg font-semibold text-ink-950">
              {posCount}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <div className="text-xs text-ink-500">{relLabels.invoice}</div>
            <div className="mt-1 text-lg font-semibold text-ink-950">
              {invoicesCount}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <div className="text-xs text-ink-500">{t.cases.exceptions}</div>
            <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">
              {data.exceptions.length}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
          <PanelHeader
            title={t.cases.linked}
            subtitle={t.cases.linkedSub}
          />
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => setShowPicker(true)}
              className="text-xs"
            >
              📑 {t.cases.openPicker}
            </Button>
          )}
        </div>

        {data.documents.length === 0 ? (
          <EmptyState
            title={t.cases.noLinkedTitle}
            description={t.cases.noLinkedBody}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.documents.map((link) => (
              <li
                key={link.document.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{link.document.display_name}</div>
                  <div className="text-xs text-ink-500">
                    {relLabels[link.relationship_type as keyof typeof relLabels] ||
                      link.relationship_type}{" "}
                    · {link.document.document_type}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={link.document.status} />
                  <Link
                    className="text-accent-600"
                    to={appPath(`/documents/${link.document.id}`)}
                  >
                    {t.common.open}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="space-y-3 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-ink-900">
              {t.cases.linkTitle}
            </h3>
            <p className="text-xs text-ink-500">{t.cases.linkHint}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.cases.linkDocumentId}>
                <Input
                  value={linkDocumentId}
                  onChange={(e) => {
                    setLinkDocumentId(e.target.value);
                    setLinkOk(false);
                  }}
                  placeholder="doc_…"
                />
              </Field>
              <Field label={t.cases.linkRelationship}>
                <Select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                >
                  {RELATIONSHIP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {relLabels[type as keyof typeof relLabels] || type}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {linkError ? <ErrorBanner message={linkError} /> : null}
            {linkOk ? (
              <SoftBanner tone="ok">{t.cases.linkSuccess}</SoftBanner>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={() => linkDoc.mutate()}
                disabled={linkDoc.isPending || !linkDocumentId.trim()}
              >
                {t.cases.linkAction}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowPicker(true)}
              >
                {t.cases.openPicker}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={t.cases.exceptionsTitle} />
        {data.exceptions.length === 0 ? (
          <EmptyState
            title={t.cases.noExceptionsTitle}
            description={t.cases.noExceptionsBody}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.exceptions.map((ex) => (
              <li key={ex.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={ex.status} />
                  <span className="font-medium">{ex.rule_key}</span>
                </div>
                <p className="mt-1 text-ink-500">{ex.explanation}</p>
                <p className="mt-1 font-mono text-xs text-ink-500">
                  {t.cases.expectedActual
                    .replace(
                      "{expected}",
                      ex.expected_value || t.common.none,
                    )
                    .replace("{actual}", ex.actual_value || t.common.none)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t.cases.reviewTasks} />
          {data.reviewTasks.length === 0 ? (
            <EmptyState
              title={t.cases.noReviewTasksTitle}
              description={t.cases.noReviewTasksBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.reviewTasks.map((task) => (
                <li key={task.id} className="px-4 py-3 text-sm">
                  <StatusBadge status={task.status} />
                  <div className="mt-1">{task.reason}</div>
                  <Link className="text-accent-600" to={appPath("/review")}>
                    {t.cases.openReview}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title={t.cases.auditTimeline} />
          <ul className="divide-y divide-slate-100">
            {data.auditEvents.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="font-medium">
                  {formatAuditAction(e.action, locale)}
                </div>
                <div className="text-xs text-ink-500">
                  <span className="font-mono">{e.action}</span> ·{" "}
                  {formatDate(e.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {showPicker && (
        <DocumentPickerModal
          open={showPicker}
          caseId={caseId}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showEditCase && (
        <EditCaseModal
          open={showEditCase}
          caseItem={data.case}
          onClose={() => setShowEditCase(false)}
        />
      )}
    </div>
  );
}

