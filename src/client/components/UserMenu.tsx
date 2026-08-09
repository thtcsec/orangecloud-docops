import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n";

type SessionUser = {
  displayName: string;
  email: string;
  role: string;
  authSource: string;
};

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  if (parts[0]?.[0]) return parts[0][0].toUpperCase();
  return (email[0] || "?").toUpperCase();
}

export function UserMenu({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const roleKey = user.role as keyof typeof t.roles.labels;
  const roleLabel = t.roles.labels[roleKey] || user.role;
  const roleSummary = t.roles.summaries[roleKey] || t.roles.summaries.viewer;
  const authLabel =
    user.authSource === "cloudflare_access"
      ? t.roles.authAccess
      : t.roles.authLocal;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex max-w-[280px] items-center gap-2.5 rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white"
          aria-hidden
        >
          {initials(user.displayName, user.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink-900">
            {user.displayName}
          </span>
          <span className="block truncate text-xs text-ink-500">
            {roleLabel}
          </span>
        </span>
        <span className="text-ink-400" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="dialog"
          aria-label={t.roles.profileTitle}
          className="absolute right-0 z-30 mt-2 w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white"
              aria-hidden
            >
              {initials(user.displayName, user.email)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink-950">
                {user.displayName}
              </div>
              <div className="truncate text-sm text-ink-500">{user.email}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {t.roles.roleLabel}
              </div>
              <div className="mt-1 font-medium text-ink-900">{roleLabel}</div>
              <p className="mt-1 text-ink-500">{roleSummary}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {t.roles.signInLabel}
              </div>
              <div className="mt-1 text-ink-800">{authLabel}</div>
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              {t.roles.manageHint}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
