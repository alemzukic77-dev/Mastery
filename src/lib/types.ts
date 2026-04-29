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
  | "COMPUTED_TOTAL"
  | "MIXED_CURRENCIES";

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
  /** ISO 4217. Set only when line currency differs from document-level currency. */
  currency?: string | null;
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
  /** When the original file contained multiple distinct documents, this is the 0-based index. */
  documentIndex?: number;
  /** IDs of all Firestore docs extracted from the same original file (including this one). */
  siblingIds?: string[];
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
