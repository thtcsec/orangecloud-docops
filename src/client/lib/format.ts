export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function statusTone(status: string): string {
  const s = status.toUpperCase();
  if (
    ["APPROVED", "EXPORTED", "PASS", "RESOLVED", "ACTIVE", "IMPLEMENTED"].includes(
      s,
    ) ||
    s === "pass"
  ) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (
    ["NEEDS_REVIEW", "WARNING", "OPEN", "IN_PROGRESS", "WAITING_REVIEW", "PLANNED"].includes(s) ||
    s === "warning" ||
    s === "open"
  ) {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (["FAILED", "REJECTED", "FAIL"].includes(s) || s === "fail") {
    return "bg-red-50 text-red-800 border-red-200";
  }
  if (["PROCESSING", "QUEUED", "UPLOADING", "EXPORTING", "VALIDATING"].includes(s)) {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}
