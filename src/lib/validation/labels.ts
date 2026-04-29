import type { ValidationCode } from "@/lib/types";

export const validationCodeLabel: Record<ValidationCode, string> = {
  TOTAL_MISMATCH: "Total mismatch",
  MISSING_FIELD: "Missing field",
  INVALID_DATE: "Invalid date",
  DATE_ORDER: "Date order",
  LINE_ITEM_MISMATCH: "Line item math",
  DUPLICATE_DOC_NUMBER: "Duplicate",
  EXTRACTION_FAILED: "Extraction failed",
  COMPUTED_TOTAL: "Total computed",
  MIXED_CURRENCIES: "Mixed currencies",
};
