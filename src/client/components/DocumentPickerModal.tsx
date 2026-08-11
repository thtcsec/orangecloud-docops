import React, { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RelationshipType } from "@shared/domain";
import { apiGet, apiPostJson } from "../lib/api";
import { Button, Field, Input, Select, StatusBadge } from "./ui";
import { useI18n } from "../i18n";

type AvailableDoc = {
  id: string;
  display_name: string;
  document_type: string;
  status: string;
  created_at: string;
};

type DocumentPickerModalProps = {
  open: boolean;
  caseId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function DocumentPickerModal({
  open,
  caseId,
  onClose,
  onSuccess,
}: DocumentPickerModalProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const titleId = useId();

  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] =
    useState<RelationshipType>("invoice");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableDocsQuery = useQuery({
    queryKey: ["available-documents", caseId],
    queryFn: () =>
      apiGet<{ items: AvailableDoc[] }>(
        `/api/cases/${caseId}/available-documents`,
      ),
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: (body: {
      documentId: string;
      relationshipType: RelationshipType;
    }) => apiPostJson(`/api/cases/${caseId}/documents`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void queryClient.invalidateQueries({
        queryKey: ["available-documents", caseId],
      });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof Error ? err.message : t.common.actionFailed,
      );
    },
  });

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedDocId(null);
      setErrorMsg(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !linkMutation.isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, linkMutation.isPending, onClose]);

  if (!open) return null;

  const allItems = availableDocsQuery.data?.items ?? [];
  const filtered = allItems.filter((doc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.display_name.toLowerCase().includes(q) ||
      doc.id.toLowerCase().includes(q) ||
      doc.document_type.toLowerCase().includes(q)
    );
  });

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setErrorMsg(t.cases.pickerSelectPrompt);
      return;
    }
    setErrorMsg(null);
    linkMutation.mutate({
      documentId: selectedDocId,
      relationshipType,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !linkMutation.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-ink-950">
            {t.cases.pickerTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={linkMutation.isPending}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
            placeholder={t.cases.pickerSearchPlaceholder}
            className="w-full"
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          {availableDocsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-ink-500">
              {t.common.loading}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">
              {t.cases.pickerNoAvailable}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      if (doc.document_type === "vendor_contract") {
                        setRelationshipType("contract");
                      } else if (doc.document_type === "purchase_order") {
                        setRelationshipType("purchase_order");
                      } else if (doc.document_type.includes("invoice")) {
                        setRelationshipType("invoice");
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-lg p-3 text-sm transition ${
                      isSelected
                        ? "border-2 border-accent-500 bg-accent-50/50 dark:border-accent-400 dark:bg-accent-950/20"
                        : "border border-slate-100 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800/60 dark:bg-slate-800/40 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink-950">
                          {doc.display_name}
                        </span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {doc.document_type}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                        {doc.id} · {doc.created_at.slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      <input
                        type="radio"
                        name="selected_doc"
                        checked={isSelected}
                        onChange={() => setSelectedDocId(doc.id)}
                        className="h-4 w-4 text-accent-600 focus:ring-accent-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleLink} className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          {errorMsg && (
            <div className="mb-3 rounded bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label={t.cases.linkRelationship}>
              <Select
                value={relationshipType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setRelationshipType(e.target.value as RelationshipType)
                }
              >
                <option value="contract">{t.cases.relationships.contract}</option>
                <option value="purchase_order">
                  {t.cases.relationships.purchase_order}
                </option>
                <option value="invoice">{t.cases.relationships.invoice}</option>
                <option value="supporting_document">
                  {t.cases.relationships.supporting_document}
                </option>
              </Select>
            </Field>

            <div className="flex items-end justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={linkMutation.isPending}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedDocId || linkMutation.isPending}
              >
                {linkMutation.isPending
                  ? t.common.loading
                  : t.cases.linkAction}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
