import type { ExtractedData, ValidationIssue } from "@/lib/types";

const FLOAT_TOLERANCE = 0.02;

export function checkRequiredFields(doc: ExtractedData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required: Array<{ field: keyof ExtractedData; label: string }> = [
    { field: "supplier", label: "Supplier" },
    { field: "documentNumber", label: "Document number" },
    { field: "issueDate", label: "Issue date" },
    { field: "total", label: "Total" },
  ];

  for (const { field, label } of required) {
    const value = doc[field];
    if (value === null || value === undefined || value === "") {
      issues.push({
        field: field as string,
        severity: "error",
        message: `${label} is missing.`,
        code: "MISSING_FIELD",
      });
    }
  }

  return issues;
}

export function checkTotal(doc: ExtractedData): ValidationIssue[] {
  if (doc.total === null || doc.lineItems.length === 0) return [];

  const itemsSum = doc.lineItems.reduce(
    (acc, item) => acc + (Number.isFinite(item.amount) ? item.amount : 0),
    0,
  );
  const tax = doc.tax ?? 0;
  const expected = round2(itemsSum + tax);
  const actual = round2(doc.total);

  if (Math.abs(expected - actual) > FLOAT_TOLERANCE) {
    return [
      {
        field: "total",
        severity: "error",
        message: `Total ${formatNum(actual)} does not match line items + tax (${formatNum(expected)}).`,
        code: "TOTAL_MISMATCH",
      },
    ];
  }
  return [];
}

export function checkDates(doc: ExtractedData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (doc.issueDate) {
    const issued = parseDate(doc.issueDate);
    if (!issued) {
      issues.push({
        field: "issueDate",
        severity: "error",
        message: `Issue date is not a valid date.`,
        code: "INVALID_DATE",
      });
    }
  }

  if (doc.dueDate) {
    const due = parseDate(doc.dueDate);
    if (!due) {
      issues.push({
        field: "dueDate",
        severity: "error",
        message: `Due date is not a valid date.`,
        code: "INVALID_DATE",
      });
    }
  }

  if (doc.issueDate && doc.dueDate) {
    const a = parseDate(doc.issueDate);
    const b = parseDate(doc.dueDate);
    if (a && b && b.getTime() < a.getTime()) {
      issues.push({
        field: "dueDate",
        severity: "error",
        message: `Due date is before issue date.`,
        code: "DATE_ORDER",
      });
    }
  }

  return issues;
}

export function checkLineItems(doc: ExtractedData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  doc.lineItems.forEach((item, index) => {
    if (
      !Number.isFinite(item.quantity) ||
      !Number.isFinite(item.unitPrice) ||
      !Number.isFinite(item.amount)
    ) {
      return;
    }
    const expected = round2(item.quantity * item.unitPrice);
    const actual = round2(item.amount);
    if (Math.abs(expected - actual) > FLOAT_TOLERANCE) {
      issues.push({
        field: `lineItems[${index}].amount`,
        severity: "warning",
        message: `Line ${index + 1}: ${item.quantity} × ${formatNum(item.unitPrice)} = ${formatNum(expected)} but amount is ${formatNum(actual)}.`,
        code: "LINE_ITEM_MISMATCH",
      });
    }
  });
  return issues;
}

export function buildDuplicateIssue(
  documentNumber: string,
): ValidationIssue {
  return {
    field: "documentNumber",
    severity: "warning",
    message: `Document number "${documentNumber}" already exists for this user.`,
    code: "DUPLICATE_DOC_NUMBER",
  };
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNum(n: number): string {
  return n.toFixed(2);
}
