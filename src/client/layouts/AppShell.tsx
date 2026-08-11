import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { normalizeRole, roleCanReview, roleIsAdmin } from "@shared/domain";
import { accessStartUrl } from "../lib/access";
import { ApiError, apiGet } from "../lib/api";
import { appPath } from "../lib/paths";
import { BrandLogo } from "../components/BrandLogo";
import {
  LanguageToggle,
  ThemeToggle,
} from "../components/HeaderControls";
import { UserMenu } from "../components/UserMenu";
import { SiteFooter } from "../components/SiteFooter";
import { QueryErrorState, AppShellSkeleton, UserChipSkeleton } from "../components/ui";
import { useI18n } from "../i18n";

type Session = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    organizationId: string;
    authSource: string;
  };
};

function isAccessSessionError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.code === "ACCESS_REDIRECT" ||
    err.code === "UNAUTHORIZED" ||
    err.status === 401
  );
}

export function AppShell() {
  const { t } = useI18n();
  const location = useLocation();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<Session>("/api/session"),
    retry: 1,
  });

  const role = normalizeRole(session.data?.user.role);
  const nav = useMemo(() => {
    const items = [
      { to: appPath("/dashboard"), label: t.nav.dashboard, show: true },
      { to: appPath("/documents"), label: t.nav.documents, show: true },
      { to: appPath("/cases"), label: t.nav.cases, show: true },
      {
        to: appPath("/review"),
        label: t.nav.review,
        show: roleCanReview(role),
      },
      { to: appPath("/rules"), label: t.nav.rules, show: true },
      {
        to: appPath("/audit"),
        label: t.nav.audit,
        show: roleIsAdmin(role),
      },
      {
        to: appPath("/settings/integrations"),
        label: t.nav.integrations,
        show: true,
      },
    ];
    return items.filter((item) => item.show);
  }, [role, t.nav]);

  const accessError = session.isError && isAccessSessionError(session.error);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center" aria-label={t.brand.name}>
            <BrandLogo variant="auto" className="h-8 w-auto max-w-[220px]" />
          </NavLink>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            {session.data ? (
              <UserMenu user={session.data.user} />
            ) : session.isError ? (
              <div className="text-sm text-red-700 dark:text-red-400">
                {t.session.notAuthenticated}
              </div>
            ) : (
              <UserChipSkeleton />
            )}
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2"
          aria-label={t.nav.primary}
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-[0.95rem] font-medium transition ${
                  isActive
                    ? "bg-accent-50 text-accent-600 dark:bg-orange-950/50"
                    : "text-ink-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div key={location.pathname} className="page-enter">
          {session.isError ? (
            accessError ? (
              <QueryErrorState
                title={t.session.accessRequiredTitle}
                message={t.session.accessRequiredBody}
                onRetry={() => {
                  window.location.assign(accessStartUrl(appPath("/dashboard")));
                }}
                retryLabel={t.session.reload}
              />
            ) : (
              <QueryErrorState
                title={t.session.loadFailedTitle}
                message={
                  (session.error as Error)?.message || t.session.loadFailedBody
                }
                onRetry={() => void session.refetch()}
                retryLabel={t.session.retry}
              />
            )
          ) : session.isLoading ? (
            <AppShellSkeleton />
          ) : (
            <Outlet />
          )}
        </div>
      </main>
      <SiteFooter compact />
    </div>
  );
}
