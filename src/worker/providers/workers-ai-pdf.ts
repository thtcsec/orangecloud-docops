import type { ExtractionResult, ExtractedField } from "./types";

const INVOICE_FIELD_KEYS = [
  "invoice_number",
  "invoice_symbol",
  "invoice_date",
  "vendor_name",
  "vendor_tax_id",
  "buyer_name",
  "buyer_tax_id",
  "currency",
  "subtotal",
  "tax_amount",
  "total_amount",
  "payment_terms",
] as const;

type InvoiceFieldKey = (typeof INVOICE_FIELD_KEYS)[number];

const MONEY_FIELDS = new Set<InvoiceFieldKey>([
  "subtotal",
  "tax_amount",
  "total_amount",
]);

const DATE_FIELDS = new Set<InvoiceFieldKey>(["invoice_date"]);

export const WORKERS_AI_PDF_MODEL = "@cf/meta/llama-3.1-8b-instruct";

function valueTypeFor(key: InvoiceFieldKey): ExtractedField["valueType"] {
  if (MONEY_FIELDS.has(key)) return "money";
  if (DATE_FIELDS.has(key)) return "date";
  return "string";
}

/** Normalize money-ish strings (1.234.567,89 / 1,234,567.89 / 1234567). */
export function normalizeMoneyString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let s = trimmed.replace(/[^\d.,-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // European / VN: 1.234.567,89
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && (s.match(/\./g) || []).length >= 1) {
      // Likely thousand separators only: 1.100.000
      s = s.replace(/\./g, "");
    } else {
      // US: 1,234,567.89
      s = s.replace(/,/g, "");
    }
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

export function mapInvoiceJsonToFields(
  raw: Record<string, unknown>,
  confidence = 0.72,
): ExtractedField[] {
  const fields: ExtractedField[] = [];
  for (const key of INVOICE_FIELD_KEYS) {
    const value = raw[key];
    if (value == null) continue;
    const asString = String(value).trim();
    if (!asString || asString.toLowerCase() === "null") continue;

    const valueType = valueTypeFor(key);
    let normalized: string | null = asString;
    if (valueType === "money") {
      normalized = normalizeMoneyString(asString);
      if (!normalized) continue;
    }

    fields.push({
      fieldName: key,
      rawValue: asString,
      normalizedValue: normalized,
      valueType,
      confidence,
      sourceKind: "ai",
      sourceReference: "workers-ai-pdf",
    });
  }
  return fields;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function markdownFromToMarkdownResult(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (Array.isArray(result)) {
    const first = result[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    if (first.format === "error") return null;
    if (typeof first.data === "string") return first.data;
    return null;
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.data === "string") return obj.data;
    if (typeof obj.markdown === "string") return obj.markdown;
  }
  return null;
}

function responseTextFromLlm(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.response === "string") return obj.response;
    if (typeof obj.result === "string") return obj.result;
    if (Array.isArray(obj.results) && typeof obj.results[0] === "string") {
      return obj.results[0];
    }
  }
  return "";
}

const SYSTEM_PROMPT = `You extract Vietnamese Contract-to-Pay invoice fields from document text.
Return ONLY a JSON object (no markdown fences) with these keys when present in the text:
invoice_number, invoice_symbol, invoice_date, vendor_name, vendor_tax_id,
buyer_name, buyer_tax_id, currency, subtotal, tax_amount, total_amount, payment_terms.
Rules:
- Only include a key when the value appears in the document text. Otherwise use null.
- Do not invent invoice numbers, tax IDs, or money amounts.
- Money: digits only (optionally with decimal). Prefer plain numbers like 1234567.89.
- Tax IDs: keep as digit strings (no spaces).
- Dates: ISO YYYY-MM-DD when the day is clear; otherwise leave the original text.
- Quotes/estimates may lack invoice_number or tax IDs — leave those null.`;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function extractInvoiceFieldsFromPdf(input: {
  ai: Ai;
  filename: string;
  bytes: ArrayBuffer;
}): Promise<ExtractionResult> {
  try {
    const blob = new Blob([new Uint8Array(input.bytes)], {
      type: "application/pdf",
    });

    let mdResult: unknown;
    try {
      const aiAny = input.ai as Ai & {
        toMarkdown: (
          files: unknown,
          opts?: unknown,
        ) => Promise<unknown>;
      };
      mdResult = await withTimeout(
        aiAny.toMarkdown({
          name: input.filename || "document.pdf",
          blob,
        }),
        45_000,
        "PDF→Markdown",
      );
    } catch (err) {
      return {
        configured: true,
        provider: "workers-ai",
        fields: [],
        message: `PDF→Markdown failed: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }

    const markdown = markdownFromToMarkdownResult(mdResult);
    if (!markdown || !markdown.trim()) {
      return {
        configured: true,
        provider: "workers-ai",
        fields: [],
        message: "PDF produced no extractable text (scanned image or empty).",
      };
    }

    const clipped = markdown.slice(0, 14_000);
    let llmRaw: unknown;
    try {
      llmRaw = await withTimeout(
        input.ai.run(WORKERS_AI_PDF_MODEL, {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Document filename: ${input.filename}\n\nMarkdown:\n${clipped}`,
            },
          ],
          max_tokens: 800,
          temperature: 0,
        }),
        45_000,
        "Field LLM",
      );
    } catch (err) {
      return {
        configured: true,
        provider: "workers-ai",
        fields: [],
        message: `Field LLM failed: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }

    const text = responseTextFromLlm(llmRaw);
    const json = extractJsonObject(text);
    if (!json) {
      return {
        configured: true,
        provider: "workers-ai",
        fields: [],
        message: "Model did not return parseable invoice JSON.",
      };
    }

    const fields = mapInvoiceJsonToFields(json);
    return {
      configured: true,
      provider: "workers-ai",
      fields,
      message:
        fields.length > 0
          ? `Extracted ${fields.length} field(s) via Workers AI (PDF→Markdown→LLM).`
          : "Workers AI ran but found no invoice fields in the PDF text.",
    };
  } catch (err) {
    return {
      configured: true,
      provider: "workers-ai",
      fields: [],
      message: `Workers AI extraction error: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

export class WorkersAiPdfExtractor {
  private readonly ai: Ai | undefined;

  constructor(ai: Ai | undefined) {
    this.ai = ai;
  }

  async extract(input: {
    r2ObjectKey: string;
    mimeType: string;
    filename?: string;
    bytes?: ArrayBuffer;
  }): Promise<ExtractionResult> {
    if (!this.ai) {
      return {
        configured: false,
        provider: "workers-ai",
        fields: [],
        message: "Workers AI binding is not configured in this environment.",
      };
    }
    if (!input.bytes) {
      return {
        configured: true,
        provider: "workers-ai",
        fields: [],
        message: "PDF bytes missing for Workers AI extraction.",
      };
    }
    return extractInvoiceFieldsFromPdf({
      ai: this.ai,
      filename: input.filename || "document.pdf",
      bytes: input.bytes,
    });
  }
}
