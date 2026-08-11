import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { USER_ROLES, normalizeRole, roleIsAdmin } from "@shared/domain";
import {
  ApiError,
  apiDeleteJson,
  apiGet,
  apiPatchJson,
  apiPostJson,
} from "../../lib/api";
import {
  Button,
  DataTable,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  QueryErrorState,
  Select,
  SoftBanner,
  TablePageSkeleton,
} from "../../components/ui";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useI18n } from "../../i18n";
import { appPath } from "../../lib/paths";

type OrgUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

type UsersResponse = { users: OrgUser[] };

export function UsersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<(typeof USER_ROLES)[number]>("viewer");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDisableId, setPendingDisableId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{
    userId: string;
    role: string;
  } | null>(null);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<{ user: { id: string; role: string } }>("/api/session"),
  });
  const isAdmin = roleIsAdmin(session.data?.user.role);
  const selfId = session.data?.user.id;

  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<UsersResponse>("/api/users"),
    enabled: isAdmin,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPostJson<{ user: OrgUser }>("/api/users", {
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        role,
      }),
    onSuccess: () => {
      setError(null);
      setMessage(t.users.created);
      setEmail("");
      setDisplayName("");
      setRole("viewer");
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  const patch = useMutation({
    mutationFn: (payload: {
      userId: string;
      body: { role?: string; status?: string; displayName?: string };
    }) =>
      apiPatchJson<{ user: OrgUser }>(`/api/users/${payload.userId}`, payload.body),
    onSuccess: () => {
      setError(null);
      setMessage(t.users.updateOk);
      setPendingRole(null);
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  const disable = useMutation({
    mutationFn: (userId: string) =>
      apiDeleteJson<{ user: OrgUser }>(`/api/users/${userId}`),
    onSuccess: () => {
      setError(null);
      setMessage(t.users.disabled);
      setPendingDisableId(null);
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : t.common.actionFailed);
    },
  });

  if (session.isLoading) return <TablePageSkeleton rows={5} />;

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title={t.users.title} description={t.users.description} />
        <SoftBanner tone="warn">{t.users.adminOnly}</SoftBanner>
      </div>
    );
  }

  if (query.isLoading) return <TablePageSkeleton rows={6} />;
  if (query.isError) {
    const err = query.error;
    const forbidden =
      err instanceof ApiError && (err.status === 403 || err.code === "FORBIDDEN");
    return (
      <QueryErrorState
        title={t.users.title}
        message={
          forbidden
            ? t.users.adminOnly
            : (err as Error).message || t.common.loadFailed
        }
        onRetry={() => void query.refetch()}
        retryLabel={t.common.retry}
      />
    );
  }

  const busy = create.isPending || patch.isPending || disable.isPending;

  return (
    <div>
      <PageHeader
        title={t.users.title}
        description={t.users.description}
        backTo={appPath("/admin")}
        backLabel={t.nav.admin}
      />

      <SoftBanner tone="info">{t.users.accessNote}</SoftBanner>

      {message ? (
        <div className="mt-3">
          <SoftBanner tone="ok">{message}</SoftBanner>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <Panel className="mt-4">
        <PanelHeader title={t.users.addTitle} subtitle={t.users.addSubtitle} />
        <form
          className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            create.mutate();
          }}
        >
          <Field label={t.users.email}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              autoComplete="off"
            />
          </Field>
          <Field label={`${t.users.displayName} (${t.common.optional})`}>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label={t.users.role}>
            <Select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as (typeof USER_ROLES)[number])
              }
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t.roles.labels[r]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={busy || !email.trim()}>
              {t.users.addSubmit}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="mt-4">
        <PanelHeader
          title={t.users.listTitle}
          subtitle={`${query.data!.users.length} ${t.users.usersCount}`}
        />
        <DataTable
          headers={[
            t.users.email,
            t.users.displayName,
            t.users.role,
            t.users.status,
            t.users.updated,
            t.common.actions,
          ]}
        >
          {query.data!.users.map((user) => {
            const isSelf = user.id === selfId;
            const statusLabel =
              user.status === "active"
                ? t.users.statusActive
                : t.users.statusDisabled;
            return (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-ink-900">
                  {user.email}
                  {isSelf ? (
                    <span className="ml-2 text-xs text-ink-500">
                      ({t.users.you})
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink-700">{user.displayName}</td>
                <td className="px-4 py-3">
                  <Select
                    className="min-w-[8rem]"
                    value={normalizeRole(user.role)}
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === normalizeRole(user.role)) return;
                      setPendingRole({ userId: user.id, role: next });
                    }}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t.roles.labels[r]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      user.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "bg-slate-100 text-ink-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-500">
                  {new Date(user.updatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {user.status === "active" ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setPendingDisableId(user.id)}
                      >
                        {t.users.disable}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          patch.mutate({
                            userId: user.id,
                            body: { status: "active" },
                          })
                        }
                      >
                        {t.users.enable}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingDisableId)}
        title={t.users.disableConfirmTitle}
        message={t.users.disableConfirmBody}
        confirmLabel={t.users.disable}
        cancelLabel={t.common.cancel}
        danger
        busy={disable.isPending}
        onCancel={() => setPendingDisableId(null)}
        onConfirm={() => {
          if (pendingDisableId) disable.mutate(pendingDisableId);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingRole)}
        title={t.users.roleChangeConfirmTitle}
        message={t.users.roleChangeConfirmBody}
        confirmLabel={t.common.confirm}
        cancelLabel={t.common.cancel}
        busy={patch.isPending}
        onCancel={() => setPendingRole(null)}
        onConfirm={() => {
          if (!pendingRole) return;
          patch.mutate({
            userId: pendingRole.userId,
            body: { role: pendingRole.role },
          });
        }}
      />
    </div>
  );
}
