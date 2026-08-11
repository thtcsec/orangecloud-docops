import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "../../lib/api";
import {
  formatAuditAction,
  formatAuditActor,
  formatAuditEntity,
} from "../../lib/audit-labels";
import { formatDate } from "../../lib/format";
import { appPath } from "../../lib/paths";
import {
  DataTable,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  TableRowsSkeleton,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type AuditResponse = {
  items: Array<{
    id: string;
    actor_type: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    request_id: string | null;
    created_at: string;
  }>;
  total: number;
};

export function AuditPage() {
  const { t, locale } = useI18n();
  const [actor, setActor] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (actor) p.set("actor", actor);
    if (entityType) p.set("entityType", entityType);
    if (action) p.set("action", action);
    if (entityId) p.set("entityId", entityId);
    if (from) p.set("from", new Date(from).toISOString());
    return p.toString();
  }, [actor, entityType, action, entityId, from]);

  const query = useQuery({
    queryKey: ["audit", qs],
    queryFn: () => apiGet<AuditResponse>(`/api/audit${qs ? `?${qs}` : ""}`),
    retry: false,
  });

  return (
    <div>
      <PageHeader
        title={t.audit.title}
        description={t.audit.description}
        backTo={appPath("/admin")}
        backLabel={t.nav.admin}
      />

      <Panel className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label={t.audit.actorId}>
            <Input value={actor} onChange={(e) => setActor(e.target.value)} />
          </Field>
          <Field label={t.audit.entityType}>
            <Select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="">{t.common.all}</option>
              <option value="document">{t.audit.entityTypes.document}</option>
              <option value="case">{t.audit.entityTypes.case}</option>
              <option value="review_task">
                {t.audit.entityTypes.review_task}
              </option>
              <option value="processing_run">
                {t.audit.entityTypes.processing_run}
              </option>
              <option value="integration">
                {t.audit.entityTypes.integration}
              </option>
            </Select>
          </Field>
          <Field label={t.audit.action}>
            <Input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder={t.audit.actionPlaceholder}
            />
          </Field>
          <Field label={t.audit.entityId}>
            <Input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </Field>
          <Field label={t.audit.fromDate}>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        {query.isLoading ? <TableRowsSkeleton rows={8} /> : null}
        {!query.isLoading && query.isError ? (
          <div className="p-4">
            <ErrorBanner
              message={
                query.error instanceof ApiError && query.error.status === 403
                  ? t.audit.adminOnly
                  : (query.error as Error).message || t.common.loadFailed
              }
              onRetry={
                query.error instanceof ApiError && query.error.status === 403
                  ? undefined
                  : () => void query.refetch()
              }
              retryLabel={t.common.retry}
            />
          </div>
        ) : null}
        {query.data && query.data.items.length === 0 ? (
          <EmptyState
            title={t.audit.emptyTitle}
            description={t.audit.emptyBody}
          />
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <DataTable
            headers={[
              t.audit.when,
              t.audit.action,
              t.audit.actor,
              t.audit.entity,
              t.audit.request,
            ]}
          >
            {query.data.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">
                    {formatAuditAction(item.action, locale)}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-ink-500">
                    {item.action}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {formatAuditActor(
                    item.actor_type,
                    item.actor_id,
                    locale,
                    t.common.none,
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {formatAuditEntity(item.entity_type, item.entity_id, locale)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {item.request_id || t.common.none}
                </td>
              </tr>
            ))}
          </DataTable>
        ) : null}
      </Panel>
    </div>
  );
}
