import type { ApiResponse } from "@shared/domain";
import { sanitizeFilename } from "@shared/filename";
import {
  isAccessChallenge,
  looksLikeHtml,
  looksLikeSpaShell,
} from "@shared/access-edge";
import { accessStartUrl } from "./access";

export { isAccessChallenge } from "@shared/access-edge";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const JSON_ACCEPT = "application/json";

function kickAccessLogin(nextPath?: string): never {
  const next =
    nextPath ||
    `${window.location.pathname}${window.location.search}` ||
    "/app/dashboard";
  window.location.assign(accessStartUrl(next));
  throw new ApiError(401, "ACCESS_REDIRECT", "Redirecting to Cloudflare Access");
}

function asNetworkError(err: unknown): ApiError {
  return new ApiError(
    0,
    "NETWORK_ERROR",
    err instanceof Error ? err.message : "Network error",
  );
}

async function withNetworkGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw asNetworkError(err);
  }
}

function parseJsonBody<T>(body: string, status: number): T {
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(body) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      status || 502,
      "INVALID_RESPONSE",
      "API returned an invalid response.",
    );
  }

  if (!json.ok) {
    throw new ApiError(
      status,
      json.error.code,
      json.error.message,
      json.error.details,
    );
  }
  return json.data;
}

function handleNonJson(opts: {
  status: number;
  body: string;
  contentType: string;
  responseUrl: string;
  wwwAuthenticate?: string | null;
  location?: string | null;
}): never {
  if (
    isAccessChallenge({
      status: opts.status,
      body: opts.body,
      responseUrl: opts.responseUrl,
      wwwAuthenticate: opts.wwwAuthenticate,
      location: opts.location,
    })
  ) {
    kickAccessLogin();
  }

  // Any Cloudflare HTML 401/403 on an API call → re-auth (stale Access session).
  if (
    [401, 403].includes(opts.status) &&
    looksLikeHtml(opts.body, opts.contentType) &&
    /cloudflare/i.test(opts.body)
  ) {
    kickAccessLogin();
  }

  if (looksLikeSpaShell(opts.body)) {
    throw new ApiError(
      opts.status || 502,
      "BAD_GATEWAY",
      "Request hit the web app instead of the API. Hard-refresh and try again.",
    );
  }

  throw new ApiError(
    opts.status || 502,
    "BAD_GATEWAY",
    `API returned HTML instead of JSON (HTTP ${opts.status || "?"} · ${opts.contentType || "unknown"}). Refresh and try again.`,
  );
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.type === "opaqueredirect") {
    kickAccessLogin();
  }

  const wwwAuthenticate = res.headers.get("www-authenticate");
  const location = res.headers.get("location");

  if (
    [301, 302, 303, 307, 308].includes(res.status) &&
    isAccessChallenge({
      status: res.status,
      body: "",
      responseUrl: res.url,
      wwwAuthenticate,
      location,
    })
  ) {
    kickAccessLogin();
  }

  const ct = res.headers.get("content-type") || "";
  const body = await res.text();

  if (
    looksLikeHtml(body, ct) ||
    isAccessChallenge({
      status: res.status,
      body,
      responseUrl: res.url,
      wwwAuthenticate,
      location,
    })
  ) {
    handleNonJson({
      status: res.status,
      body,
      contentType: ct,
      responseUrl: res.url,
      wwwAuthenticate,
      location,
    });
  }

  return parseJsonBody<T>(body, res.status);
}

export async function apiGet<T>(path: string): Promise<T> {
  return withNetworkGuard(async () => {
    const res = await fetch(path, {
      credentials: "include",
      redirect: "manual",
      headers: { Accept: JSON_ACCEPT },
    });
    return parseResponse<T>(res);
  });
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  return withNetworkGuard(async () => {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: JSON_ACCEPT,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    return parseResponse<T>(res);
  });
}

export async function apiPutJson<T>(path: string, body: unknown): Promise<T> {
  return withNetworkGuard(async () => {
    const res = await fetch(path, {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: JSON_ACCEPT,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    return parseResponse<T>(res);
  });
}

export async function apiPatchJson<T>(path: string, body: unknown): Promise<T> {
  return withNetworkGuard(async () => {
    const res = await fetch(path, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: JSON_ACCEPT,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    return parseResponse<T>(res);
  });
}

export async function apiDeleteJson<T>(path: string): Promise<T> {
  return withNetworkGuard(async () => {
    const res = await fetch(path, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: JSON_ACCEPT },
      redirect: "manual",
    });
    return parseResponse<T>(res);
  });
}

/** Fetch binary/text content (e.g. document preview). Not JSON. */
export async function apiFetchBlob(path: string): Promise<{
  blob: Blob;
  contentType: string;
}> {
  return withNetworkGuard(async () => {
    const res = await fetch(path, {
      credentials: "include",
      redirect: "manual",
      headers: { Accept: "*/*" },
    });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      kickAccessLogin();
    }
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (looksLikeHtml(body, ct)) {
        handleNonJson({
          status: res.status,
          body,
          contentType: ct,
          responseUrl: res.url,
          wwwAuthenticate: res.headers.get("www-authenticate"),
          location: res.headers.get("location"),
        });
      }
      try {
        const parsed = JSON.parse(body) as {
          error?: { code?: string; message?: string };
        };
        throw new ApiError(
          res.status,
          parsed.error?.code || "REQUEST_FAILED",
          parsed.error?.message || `Request failed (${res.status})`,
        );
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(
          res.status,
          "REQUEST_FAILED",
          body.slice(0, 200) || `HTTP ${res.status}`,
        );
      }
    }
    const blob = await res.blob();
    return { blob, contentType: ct || blob.type || "application/octet-stream" };
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function isAllowedUploadFile(file: File): {
  ok: true;
} | { ok: false; code: "UNSUPPORTED_FILE_TYPE" } {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase().split(";")[0]?.trim() ?? "";
  const extOk = name.endsWith(".pdf") || name.endsWith(".xml");
  const mimeOk =
    mime === "" ||
    mime === "application/octet-stream" ||
    mime === "application/pdf" ||
    mime === "application/xml" ||
    mime === "text/xml";
  if (extOk && mimeOk) return { ok: true };
  return { ok: false, code: "UNSUPPORTED_FILE_TYPE" };
}

/**
 * Upload via JSON + base64 (not multipart). Multipart POSTs are frequently
 * answered with Cloudflare HTML 403 even when Access session is valid.
 */
export async function apiUploadDocument<T>(
  file: File,
  fields?: { documentType?: string; caseId?: string; displayName?: string },
  onProgress?: (pct: number) => void,
): Promise<T> {
  let progressTimer: number | undefined;
  if (onProgress) {
    let tick = 8;
    onProgress(tick);
    progressTimer = window.setInterval(() => {
      tick = Math.min(90, tick + Math.max(1, Math.round((90 - tick) * 0.08)));
      onProgress(tick);
    }, 200);
  }

  try {
    const buffer = await file.arrayBuffer();
    if (onProgress) onProgress(55);
    const contentBase64 = arrayBufferToBase64(buffer);
    const payload = {
      filename: sanitizeFilename(file.name),
      displayName: fields?.displayName?.trim() || file.name,
      mimeType: file.type || "application/octet-stream",
      documentType: fields?.documentType || undefined,
      caseId: fields?.caseId || undefined,
      contentBase64,
    };
    const data = await apiPostJson<T>("/api/documents", payload);
    if (onProgress) onProgress(100);
    return data;
  } finally {
    if (progressTimer !== undefined) window.clearInterval(progressTimer);
  }
}

/** @deprecated Prefer apiUploadDocument — multipart is blocked by edge WAF. */
export async function apiUpload<T>(
  _path: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<T> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "VALIDATION_ERROR", "file is required");
  }
  return apiUploadDocument<T>(
    file,
    {
      documentType: String(form.get("documentType") || "") || undefined,
      caseId: String(form.get("caseId") || "") || undefined,
      displayName: String(form.get("displayName") || "") || undefined,
    },
    onProgress,
  );
}
