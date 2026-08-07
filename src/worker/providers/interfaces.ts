/**
 * Provider interfaces. Phase 1.5 enables deterministic VN invoice XML parsing
 * and a first set of Contract-to-Pay rules. No fabricated AI extraction.
 */

export type {
  ClassificationResult,
  ConversionResult,
  ExtractionResult,
  NormalizationResult,
  RuleEvaluationResult,
  ExportResult,
  ExtractedField,
  EvaluatedRule,
} from "./types";

export {
  VietnamInvoiceXmlParser,
  parseVietnamInvoiceXmlText,
} from "./vietnam-invoice-xml";

export {
  evaluateDocumentRules,
  IMPLEMENTED_RULE_KEYS,
} from "./rules";

import type {
  ClassificationResult,
  ConversionResult,
  ExtractionResult,
  NormalizationResult,
  RuleEvaluationResult,
  ExportResult,
} from "./types";

export interface DocumentClassifier {
  classify(input: {
    mimeType: string;
    filename: string;
    r2ObjectKey?: string;
  }): Promise<ClassificationResult>;
}

export interface DocumentConverter {
  convert(input?: {
    r2ObjectKey: string;
    mimeType: string;
  }): Promise<ConversionResult>;
}

export interface DocumentExtractor {
  extract(input?: {
    r2ObjectKey: string;
    mimeType: string;
  }): Promise<ExtractionResult>;
}

export interface FieldNormalizer {
  normalize(input: {
    fields: ExtractionResult["fields"];
  }): Promise<NormalizationResult>;
}

export interface ExportAdapter {
  export(input: { caseId: string }): Promise<ExportResult>;
}

export class HeuristicClassifier implements DocumentClassifier {
  async classify(input: {
    mimeType: string;
    filename: string;
    r2ObjectKey?: string;
  }): Promise<ClassificationResult> {
    const lower = input.filename.toLowerCase();
    let documentType: ClassificationResult["documentType"] = "unknown";
    if (input.mimeType.includes("xml") || lower.endsWith(".xml")) {
      documentType = "invoice_xml";
    } else if (lower.includes("po") || lower.includes("purchase")) {
      documentType = "purchase_order";
    } else if (lower.includes("contract")) {
      documentType = "vendor_contract";
    } else if (input.mimeType === "application/pdf") {
      documentType = "invoice_pdf";
    }
    return {
      documentType,
      confidence: documentType === "invoice_xml" ? 0.85 : 0.35,
      provider: "heuristic-filename",
      configured: true,
    };
  }
}

/** @deprecated Use HeuristicClassifier */
export class NotConfiguredClassifier extends HeuristicClassifier {}

export class NotConfiguredExtractor implements DocumentExtractor {
  async extract(_input?: {
    r2ObjectKey: string;
    mimeType: string;
  }): Promise<ExtractionResult> {
    return {
      configured: false,
      provider: "none",
      fields: [],
      message:
        "No unstructured extraction provider configured. Use invoice XML or Phase 2 Workers AI.",
    };
  }
}

/** Kept for workflow strategy naming compatibility */
export class NotConfiguredVietnamInvoiceXmlParser {
  async parse(_input?: { r2ObjectKey: string }): Promise<ExtractionResult> {
    return {
      configured: false,
      provider: "vietnam-invoice-xml",
      fields: [],
      message: "Call VietnamInvoiceXmlParser with xmlText instead",
    };
  }
}

export class NotConfiguredConverter implements DocumentConverter {
  async convert(_input?: {
    r2ObjectKey: string;
    mimeType: string;
  }): Promise<ConversionResult> {
    return {
      configured: false,
      message: "Document conversion is not configured",
    };
  }
}

export class PassthroughNormalizer implements FieldNormalizer {
  async normalize(input: {
    fields: ExtractionResult["fields"];
  }): Promise<NormalizationResult> {
    return {
      configured: true,
      fields: input.fields.map((f) => ({
        ...f,
        normalizedValue: f.normalizedValue ?? f.rawValue,
      })),
      message: "Passthrough normalization",
    };
  }
}

export class NotConfiguredNormalizer implements FieldNormalizer {
  async normalize(): Promise<NormalizationResult> {
    return {
      configured: false,
      fields: [],
      message: "Field normalization not configured",
    };
  }
}

export class NotConfiguredRuleEvaluator {
  async evaluate(): Promise<RuleEvaluationResult> {
    return {
      configured: false,
      results: [],
      message: "Use evaluateDocumentRules()",
    };
  }
}

export class NotConfiguredExportAdapter implements ExportAdapter {
  async export(): Promise<ExportResult> {
    return {
      configured: false,
      message: "Export adapters are not configured",
    };
  }
}
