export type DocumentType = "invoice" | "purchase_order" | "unknown";

export type DocumentStatus =
  | "uploaded"
  | "needs_review"
  | "validated"
  | "rejected";

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "TOTAL_MISMATCH"
  | "MISSING_FIELD"
  | "INVALID_DATE"
  | "DATE_ORDER"
  | "LINE_ITEM_MISMATCH"
  | "DUPLICATE_DOC_NUMBER"
  | "EXTRACTION_FAILED"
  | "COMPUTED_TOTAL";

export interface ValidationIssue {
  field: string;
  severity: ValidationSeverity;
  message: string;
  code: ValidationCode;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface OriginalFileMeta {
  storagePath: string;
  contentType: string;
  size: number;
  fileName: string;
  downloadUrl?: string | null;
}

export interface ProcessedDocument {
  id: string;
  type: DocumentType;
  supplier: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  status: DocumentStatus;
  validationIssues: ValidationIssue[];
  originalFile: OriginalFileMeta;
  rawExtraction?: unknown;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string;
}

export interface ExtractedData {
  type: DocumentType;
  supplier: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}
