import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, apiPostJson } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { appPath } from "../../lib/paths";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  QueryErrorState,
  SoftBanner,
  SplitListSkeleton,
  StatusBadge,
  TextArea,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type ReviewsResponse = {
  items: Array<{
    id: string;
    document_id: string | null;
    case_id: string | null;
    status: string;
    reason: string;
    created_at: string;
  }>;
  total: number;
};

type DecisionResponse = {
  decisionId: string;
  decision: string;
  reviewTaskId: string;
  documentId?: string | null;
  documentStatus?: string;
  exportStatus?: "skipped" | "exported" | "failed" | "n/a";
  exportError?: string;
};

export function ReviewPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<
    "approved" | "rejected" | "correction_requested" | null
  >(null);

  const query = useQuery({
    queryKey: ["reviews", "open"],
    queryFn: () => apiGet<ReviewsResponse>("/api/reviews?status=open"),
  });

  const decision = useMutation({
    mutationFn: (payload: {
      reviewTaskId: string;
      decision: "approved" | "rejected" | "correction_requested";
      comment?: string;
      documentId?: string | null;
      caseId?: string | null;
    }) =>
      apiPostJson<DecisionResponse>(
        `/api/reviews/${payload.reviewTaskId}/decision`,
        {
          decision: payload.decision,
          comment: payload.comment,
        },
      ),
    onSuccess: (data, variables) => {
      setComment("");
      setSelectedId(null);
      setError(null);
      setPendingDecision(null);
      if (variables.decision === "approved") {
        if (data.exportStatus === "exported") {
          setSuccess(t.review.approveExported);
        } else if (data.exportStatus === "failed") {
          setSuccess(t.review.approveExportFailed);
        } else {
          setSuccess(t.review.approveDone);
        }
      } else if (variables.decision === "rejected") {
        setSuccess(t.review.rejectDone);
      } else {
        setSuccess(t.review.correctionDone);
      }
      void qc.invalidateQueries({ queryKey: ["reviews"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
      if (variables.documentId) {
        void qc.invalidateQueries({
          queryKey: ["document", variables.documentId],
        });
      }
      if (variables.caseId) {
        void qc.invalidateQueries({ queryKey: ["case", variables.caseId] });
      }
    },
    onError: (err) => {
      setSuccess(null);
      setError(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  if (query.isLoading) return <SplitListSkeleton />;
  if (query.isError) {
    return (
      <QueryErrorState
        title={t.review.title}
        message={(query.error as Error).message || t.common.loadFailed}
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  const items = query.data!.items;
  const selected = items.find((i) => i.id === selectedId) || items[0] || null;

  return (
    <div>
      <PageHeader
        title={t.review.title}
        description={t.review.description}
      />

      {success ? (
        <div className="mb-4">
          <SoftBanner tone="ok">{success}</SoftBanner>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          {items.length === 0 ? (
            <EmptyState
              title={t.review.clearTitle}
              description={t.review.clearBody}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                      selected?.id === item.id ? "bg-accent-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-ink-500">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-800">{item.reason}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-3 p-4">
          {!selected ? (
            <EmptyState
              title={t.review.selectTitle}
              description={t.review.selectBody}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">
                  {t.review.task} {selected.id}
                </h2>
                <p className="mt-1 text-sm text-ink-500">{selected.reason}</p>
                <p className="mt-2 text-xs text-ink-500">{t.review.approveHint}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {selected.document_id ? (
                  <Link
                    className="font-medium text-accent-600 hover:underline"
                    to={appPath(`/documents/${selected.document_id}`)}
                  >
                    {t.review.openDocument}
                  </Link>
                ) : null}
                {selected.case_id ? (
                  <Link
                    className="font-medium text-accent-600 hover:underline"
                    to={appPath(`/cases/${selected.case_id}`)}
                  >
                    {t.review.openCase}
                  </Link>
                ) : null}
              </div>

              <Field label={t.review.comment}>
                <TextArea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.review.commentPlaceholder}
                />
              </Field>

              {error ? <ErrorBanner message={error} /> : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setPendingDecision("approved")}
                  disabled={decision.isPending}
                >
                  {t.review.approve}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setPendingDecision("rejected")}
                  disabled={decision.isPending}
                >
                  {t.review.reject}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPendingDecision("correction_requested")}
                  disabled={decision.isPending}
                >
                  {t.review.correction}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={pendingDecision === "approved"}
        title={t.review.approveConfirmTitle}
        message={t.review.approveConfirmBody}
        confirmLabel={t.review.approve}
        cancelLabel={t.common.cancel}
        busy={decision.isPending}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => {
          if (!selected) return;
          decision.mutate({
            reviewTaskId: selected.id,
            decision: "approved",
            comment,
            documentId: selected.document_id,
            caseId: selected.case_id,
          });
        }}
      />
      <ConfirmDialog
        open={pendingDecision === "rejected"}
        title={t.review.rejectConfirmTitle}
        message={t.review.rejectConfirmBody}
        confirmLabel={t.review.reject}
        cancelLabel={t.common.cancel}
        danger
        busy={decision.isPending}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => {
          if (!selected) return;
          decision.mutate({
            reviewTaskId: selected.id,
            decision: "rejected",
            comment,
            documentId: selected.document_id,
            caseId: selected.case_id,
          });
        }}
      />
      <ConfirmDialog
        open={pendingDecision === "correction_requested"}
        title={t.review.correctionConfirmTitle}
        message={t.review.correctionConfirmBody}
        confirmLabel={t.review.correction}
        cancelLabel={t.common.cancel}
        busy={decision.isPending}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => {
          if (!selected) return;
          decision.mutate({
            reviewTaskId: selected.id,
            decision: "correction_requested",
            comment,
            documentId: selected.document_id,
            caseId: selected.case_id,
          });
        }}
      />
    </div>
  );
}
