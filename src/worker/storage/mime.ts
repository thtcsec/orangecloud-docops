import { getExtension } from "./filename";

export const ALLOWED_UPLOADS = {
  pdf: {
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
  },
  xml: {
    extensions: ["xml"],
    mimeTypes: ["application/xml", "text/xml"],
  },
} as const;

export type AllowedKind = keyof typeof ALLOWED_UPLOADS;

export function validateMimeAndExtension(
  filename: string,
  mimeType: string,
): { ok: true; kind: AllowedKind } | { ok: false; code: string; message: string } {
  const ext = getExtension(filename);
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";

  for (const [kind, spec] of Object.entries(ALLOWED_UPLOADS) as [
    AllowedKind,
    (typeof ALLOWED_UPLOADS)[AllowedKind],
  ][]) {
    const extOk = (spec.extensions as readonly string[]).includes(ext);
    const mimeOk =
      (spec.mimeTypes as readonly string[]).includes(mime) ||
      // Browsers sometimes send a generic MIME for local files.
      mime === "" ||
      mime === "application/octet-stream";
    if (extOk && mimeOk) {
      return { ok: true, kind };
    }
    if (extOk && !mimeOk) {
      return {
        ok: false,
        code: "MIME_MISMATCH",
        message: `Extension .${ext} does not match MIME type ${mimeType}`,
      };
    }
  }

  return {
    ok: false,
    code: "UNSUPPORTED_FILE_TYPE",
    message: "Only PDF and XML uploads are supported",
  };
}
