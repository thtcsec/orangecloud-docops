export type LogFields = {
  requestId?: string;
  organizationId?: string;
  userId?: string;
  documentId?: string;
  documentVersionId?: string;
  processingRunId?: string;
  workflowInstanceId?: string;
  queueAttempt?: number;
  messageId?: string;
  errorCode?: string;
  [key: string]: unknown;
};

function serialize(level: string, message: string, fields: LogFields = {}) {
  // Never log document bodies, extracted text, tokens, or credentials.
  const safe = { ...fields };
  for (const key of Object.keys(safe)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("authorization") ||
      lower.includes("body") ||
      lower.includes("extracted")
    ) {
      delete safe[key];
    }
  }
  return JSON.stringify({
    level,
    message,
    ts: new Date().toISOString(),
    ...safe,
  });
}

export const logger = {
  info(message: string, fields?: LogFields) {
    console.log(serialize("info", message, fields));
  },
  warn(message: string, fields?: LogFields) {
    console.warn(serialize("warn", message, fields));
  },
  error(message: string, fields?: LogFields) {
    console.error(serialize("error", message, fields));
  },
};
