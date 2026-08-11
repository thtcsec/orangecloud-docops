import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { statusTone } from "../lib/format";

export function BackLink({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-accent-600"
    >
      <span
        aria-hidden
        className="inline-block transition-transform group-hover:-translate-x-0.5"
      >
        ←
      </span>
      {label}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel,
  className = "mb-6",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {backTo && backLabel ? <BackLink to={backTo} label={backLabel} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-base text-ink-500">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${statusTone(status)}`}
    >
      {label ?? status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade-in flex flex-col items-start gap-3 px-4 py-10">
      <div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        <p className="mt-1 max-w-xl text-base text-ink-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  className = "",
  autoFocus,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const styles = {
    primary:
      "bg-accent-600 text-white hover:bg-accent-500 disabled:bg-orange-300",
    secondary:
      "border border-slate-300 bg-white text-ink-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800",
    danger: "bg-danger-600 text-white hover:bg-red-700",
    ghost: "text-ink-700 hover:bg-slate-100 dark:hover:bg-slate-800",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      autoFocus={autoFocus}
      className={`inline-flex items-center justify-center rounded-md px-3.5 py-2.5 text-[0.95rem] font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-accent-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-accent-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 ${props.className ?? ""}`}
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-accent-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 ${props.className ?? ""}`}
    />
  );
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="animate-fade-in flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    >
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          className="shrink-0 border-red-200 text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-100 dark:hover:bg-red-950"
          onClick={onRetry}
        >
          {retryLabel || "Retry"}
        </Button>
      ) : null}
    </div>
  );
}

export function SoftBanner({
  tone = "ok",
  children,
}: {
  tone?: "ok" | "warn" | "info";
  children: ReactNode;
}) {
  const styles = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100",
  }[tone];
  return (
    <div className={`animate-fade-in rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="animate-fade-in flex items-center gap-3 px-4 py-10 text-base text-ink-500"
      aria-live="polite"
    >
      <span
        className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-accent-500"
        aria-hidden
      />
      {label}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/90 dark:bg-slate-700/70 ${className}`}
      aria-hidden
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Panel key={i} className="space-y-3 px-4 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </Panel>
        ))}
      </div>
      <Panel className="p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      </Panel>
    </div>
  );
}

/** Row placeholders inside an existing table Panel (header/filters already shown). */
export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="animate-fade-in divide-y divide-slate-100 dark:divide-slate-800"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-[32%]" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function TablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-fade-in space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Panel>
      <Panel>
        <TableRowsSkeleton rows={rows} />
      </Panel>
    </div>
  );
}

export function FormPanelSkeleton() {
  return (
    <div className="animate-fade-in space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Panel className="max-w-2xl space-y-4 p-4">
        <Skeleton className="h-36 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-28" />
      </Panel>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Panel key={i} className="space-y-3 px-4 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </Panel>
        ))}
      </div>
      <Panel className="space-y-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </Panel>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-fade-in space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3 max-w-lg" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="space-y-3 p-4 lg:col-span-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </Panel>
        <Panel className="space-y-3 p-4 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-24 w-full" />
        </Panel>
      </div>
      <Panel className="space-y-3 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Panel>
    </div>
  );
}

export function SplitListSkeleton() {
  return (
    <div className="animate-fade-in space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="space-y-3 p-3 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </Panel>
        <Panel className="space-y-3 p-4 lg:col-span-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="animate-fade-in space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <Panel key={i} className="space-y-3 p-4">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function UserChipSkeleton() {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-slate-200/80 px-2.5 py-1.5 dark:border-slate-700">
      <Skeleton className="size-8 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-14" />
      </div>
    </div>
  );
}

/** Full-page query failure with optional back + retry. */
export function QueryErrorState({
  message,
  onRetry,
  retryLabel,
  backTo,
  backLabel,
  title,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  backTo?: string;
  backLabel?: string;
  title?: string;
}) {
  return (
    <div className="animate-fade-in space-y-4">
      {backTo && backLabel ? <BackLink to={backTo} label={backLabel} /> : null}
      {title ? (
        <h1 className="text-3xl font-semibold tracking-tight text-ink-950">
          {title}
        </h1>
      ) : null}
      <ErrorBanner
        message={message}
        onRetry={onRetry}
        retryLabel={retryLabel}
      />
    </div>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-ink-500 dark:bg-slate-900/60">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {children}
        </tbody>
      </table>
    </div>
  );
}
