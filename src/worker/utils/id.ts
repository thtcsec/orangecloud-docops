export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function createRequestId(): string {
  return createId("req");
}

export function nowIso(): string {
  return new Date().toISOString();
}
