/**
 * Phase 1 provider interfaces. Implementations are disabled / not configured.
 * Do not return fabricated extraction fields.
 */

export type ClassificationResult = {
  documentType: "vendor_contract" | "purchase_order" | "invoice_xml" | "invoice_pdf" | "unknown";
  confidence: number;
  provider: string;
  configured: boolean;
};

export type ConversionResult = {
  configured: boolean;
  artifactKey?: string;
  message: string;
};

export type ExtractionResult = {
  configured: boolean;
  provider: string;
  fields: never[];
  message: string;
};

export type NormalizationResult = {
  configured: boolean;
  fields: never[];
  message: string;
};

export type RuleEvaluationResult = {
  configured: boolean;
  results: never[];
  message: string;
};

export type ExportResult = {
  configured: boolean;
  message: string;
};

export interface DocumentClassifier {
  classify(input: {
    mimeType: string;
    filename: string;
    r2ObjectKey?: string;
  }): Promise<ClassificationResult>;
}

export interface DocumentConverter {
  convert(input?: { r2ObjectKey: string; mimeType: string }): Promise<ConversionResult>;
}

export interface DocumentExtractor {
  extract(input?: { r2ObjectKey: string; mimeType: string }): Promise<ExtractionResult>;
}

export interface VietnamInvoiceXmlParser {
  parse(input?: { r2ObjectKey: string }): Promise<ExtractionResult>;
}

export interface FieldNormalizer {
  normalize(input: { fields: never[] }): Promise<NormalizationResult>;
}

export interface RuleEvaluator {
  evaluate(input: { caseId?: string; documentId: string }): Promise<RuleEvaluationResult>;
}

export interface ExportAdapter {
  export(input: { caseId: string }): Promise<ExportResult>;
}

export class NotConfiguredClassifier implements DocumentClassifier {
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
      confidence: 0.2,
      provider: "heuristic-filename",
      configured: true,
    };
  }
}

export class NotConfiguredExtractor implements DocumentExtractor {
  async extract(_input?: { r2ObjectKey: string; mimeType: string }): Promise<ExtractionResult> {
    return {
      configured: false,
      provider: "none",
      fields: [],
      message: "No extraction provider configured in Phase 1",
    };
  }
}

export class NotConfiguredVietnamInvoiceXmlParser
  implements VietnamInvoiceXmlParser
{
  async parse(_input?: { r2ObjectKey: string }): Promise<ExtractionResult> {
    return {
      configured: false,
      provider: "vietnam-invoice-xml",
      fields: [],
      message: "Vietnamese invoice XML parsing is planned for Phase 2",
    };
  }
}

export class NotConfiguredConverter implements DocumentConverter {
  async convert(_input?: { r2ObjectKey: string; mimeType: string }): Promise<ConversionResult> {
    return {
      configured: false,
      message: "Document conversion is not configured in Phase 1",
    };
  }
}

export class NotConfiguredNormalizer implements FieldNormalizer {
  async normalize(): Promise<NormalizationResult> {
    return {
      configured: false,
      fields: [],
      message: "Field normalization is planned for Phase 2",
    };
  }
}

export class NotConfiguredRuleEvaluator implements RuleEvaluator {
  async evaluate(): Promise<RuleEvaluationResult> {
    return {
      configured: false,
      results: [],
      message: "Deterministic rule evaluation begins in Phase 2",
    };
  }
}

export class NotConfiguredExportAdapter implements ExportAdapter {
  async export(): Promise<ExportResult> {
    return {
      configured: false,
      message: "Export adapters are not configured in Phase 1",
    };
  }
}
