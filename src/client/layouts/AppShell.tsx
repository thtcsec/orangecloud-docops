import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import { BrandLogo } from "../components/BrandLogo";
import {
  LanguageToggle,
  ThemeToggle,
} from "../components/HeaderControls";
import { SiteFooter } from "../components/SiteFooter";
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

export function AppShell() {
  const { t } = useI18n();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<Session>("/api/session"),
  });

  const nav = [
    { to: "/dashboard", label: t.nav.dashboard },
    { to: "/documents", label: t.nav.documents },
    { to: "/cases", label: t.nav.cases },
    { to: "/review", label: t.nav.review },
    { to: "/rules", label: t.nav.rules },
    { to: "/audit", label: t.nav.audit },
    { to: "/settings/integrations", label: t.nav.integrations },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center" aria-label={t.brand.name}>
            <BrandLogo variant="auto" className="h-8 w-auto max-w-[220px]" />
          </NavLink>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <div className="text-right text-xs text-ink-500">
              {session.data ? (
                <>
                  <div className="font-medium text-ink-800">
                    {session.data.user.displayName}
                  </div>
                  <div>
                    {session.data.user.email} · {session.data.user.role}
                  </div>
                </>
              ) : session.isError ? (
                <div className="text-red-700 dark:text-red-400">
                  {t.session.notAuthenticated}
                </div>
              ) : (
                <div>{t.session.resolving}</div>
              )}
            </div>
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
                `rounded-md px-3 py-1.5 text-sm font-medium transition ${
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
        <Outlet />
      </main>
      <SiteFooter compact />
    </div>
  );
}
