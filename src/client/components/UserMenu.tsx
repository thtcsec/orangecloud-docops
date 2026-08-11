import { Link } from "react-router-dom";
import { useEffect, useId, useRef, useState } from "react";
import { appPath } from "../lib/paths";
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
    <div className="relative z-50" ref={rootRef}>
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
          role="menu"
          aria-label={t.roles.profileTitle}
          className="absolute right-0 z-[60] mt-2 w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-950 dark:ring-white/10"
        >
          <div className="flex items-start gap-3 px-1 py-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white"
              aria-hidden
            >
              {initials(user.displayName, user.email)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink-950">
                {user.displayName}
              </div>
              <div className="truncate text-xs text-ink-500">{user.email}</div>
              <div className="mt-1 text-xs font-medium text-ink-700">
                {roleLabel}
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
            <Link
              to={appPath("/settings/profile")}
              role="menuitem"
              className="block rounded-md px-2 py-2 text-sm font-medium text-accent-700 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-slate-900"
              onClick={() => setOpen(false)}
            >
              {t.roles.viewProfile}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
