import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPostJson } from "../../lib/api";
import { formatDate } from "../../lib/format";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Panel,
  PanelHeader,
  QueryErrorState,
  SoftBanner,
  StatusBadge,
  DataTable,
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

  if (query.isLoading) return <LoadingBlock label={t.common.loading} />;
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
              placeholder="C2P-2026-…"
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
              <Link className="font-medium text-accent-700" to={`/cases/${createdCaseId}`}>
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
                    to={`/cases/${item.id}`}
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

export function CaseDetailPage() {
  const { t } = useI18n();
  const { caseId = "" } = useParams();
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => apiGet<CaseDetail>(`/api/cases/${caseId}`),
    enabled: Boolean(caseId),
  });

  if (query.isLoading) return <LoadingBlock label={t.common.loading} />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.cases.title}
        backTo="/cases"
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

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.case.reference}
        description={`Vendor ${data.case.vendor_name || t.common.none} · Tax ID ${data.case.vendor_tax_id || t.common.none}`}
        backTo="/cases"
        backLabel={t.common.backToCases}
      />

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

      <Panel>
        <PanelHeader
          title={t.cases.linked}
          subtitle={t.cases.linkedSub}
        />
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
                    {link.relationship_type} · {link.document.document_type}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={link.document.status} />
                  <Link
                    className="text-accent-600"
                    to={`/documents/${link.document.id}`}
                  >
                    {t.common.open}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
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
                  expected={ex.expected_value || t.common.none} actual=
                  {ex.actual_value || t.common.none}
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
                  <Link className="text-accent-600" to="/review">
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
                <div className="font-medium">{e.action}</div>
                <div className="text-xs text-ink-500">
                  {formatDate(e.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
