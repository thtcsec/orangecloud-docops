import type { ApiResponse } from "@shared/domain";
import { accessStartUrl } from "./access";

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

function kickAccessLogin(): never {
  const next = `${window.location.pathname}${window.location.search}` || "/app/dashboard";
  window.location.assign(accessStartUrl(next));
  throw new ApiError(401, "ACCESS_REDIRECT", "Redirecting to Cloudflare Access");
}

async function parseResponse<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") || "";
  // Access protects /api* → unauthenticated fetch gets the login HTML, not JSON.
  if (ct.includes("text/html")) {
    kickAccessLogin();
  }
  try {
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.ok) {
      throw new ApiError(
        res.status,
        json.error.code,
        json.error.message,
        json.error.details,
      );
    }
    return json.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    kickAccessLogin();
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  return parseResponse<T>(res);
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiUpload<T>(
  path: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<T> {
  // Fetch does not expose upload progress; use XHR for progress UI.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiResponse<T>;
        if (!json.ok) {
          reject(
            new ApiError(
              xhr.status,
              json.error.code,
              json.error.message,
              json.error.details,
            ),
          );
          return;
        }
        resolve(json.data);
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Network error"));
    xhr.send(form);
  });
}
