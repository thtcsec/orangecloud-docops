export type ExtractedField = {
  fieldName: string;
  rawValue: string | null;
  normalizedValue: string | null;
  valueType: "string" | "number" | "date" | "money";
  confidence: number;
  sourceKind: "xml" | "heuristic" | "ai" | "none";
  sourceReference?: string;
};

export type ClassificationResult = {
  documentType:
    | "vendor_contract"
    | "purchase_order"
    | "invoice_xml"
    | "invoice_pdf"
    | "unknown";
  confidence: number;
  provider: string;
  configured: boolean;
  /** Filename looks like a quote/estimate rather than a tax invoice. */
  likelyQuote?: boolean;
};

export type ConversionResult = {
  configured: boolean;
  artifactKey?: string;
  message: string;
};

export type ExtractionResult = {
  configured: boolean;
  provider: string;
  fields: ExtractedField[];
  message: string;
};

export type NormalizationResult = {
  configured: boolean;
  fields: ExtractedField[];
  message: string;
};

export type EvaluatedRule = {
  ruleKey: string;
  ruleVersion: string;
  status: "pass" | "warning" | "fail" | "not_applicable" | "not_evaluated";
  severity: "info" | "warning" | "error" | null;
  expectedValue: string | null;
  actualValue: string | null;
  explanation: string;
};

export type RuleEvaluationResult = {
  configured: boolean;
  results: EvaluatedRule[];
  message: string;
};

export type ExportResult = {
  configured: boolean;
  message: string;
};
