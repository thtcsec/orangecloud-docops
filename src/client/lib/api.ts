import type { ApiResponse } from "@shared/domain";

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

async function parseResponse<T>(res: Response): Promise<T> {
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
