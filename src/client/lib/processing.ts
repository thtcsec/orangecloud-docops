/** Document / run statuses that mean the pipeline is still moving. */
export const IN_FLIGHT_DOCUMENT_STATUSES = new Set([
  "UPLOADING",
  "QUEUED",
  "PROCESSING",
  "EXTRACTED",
  "VALIDATING",
  "EXPORTING",
]);

export const IN_FLIGHT_RUN_STATUSES = new Set([
  "pending",
  "queued",
  "running",
  "PENDING",
  "QUEUED",
  "RUNNING",
]);

export function isDocumentInFlight(status: string | null | undefined): boolean {
  if (!status) return false;
  return IN_FLIGHT_DOCUMENT_STATUSES.has(status.toUpperCase());
}

export function isRunInFlight(status: string | null | undefined): boolean {
  if (!status) return false;
  return IN_FLIGHT_RUN_STATUSES.has(status) || IN_FLIGHT_RUN_STATUSES.has(status.toUpperCase());
}

export function documentsListNeedsPoll(
  items: Array<{
    status: string;
    latestProcessing?: { status: string } | null;
  }>,
): boolean {
  return items.some(
    (item) =>
      isDocumentInFlight(item.status) ||
      isRunInFlight(item.latestProcessing?.status),
  );
}
