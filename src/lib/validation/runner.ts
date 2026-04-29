import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type {
  DocumentStatus,
  ExtractedData,
  ValidationIssue,
} from "@/lib/types";
import {
  autoComputeTotal,
  buildDuplicateIssue,
  checkDates,
  checkLineItems,
  checkRequiredFields,
  checkTotal,
} from "./rules";

interface RunValidationOptions {
  data: ExtractedData;
  userId: string;
  documentId: string;
  db: Firestore;
}

export interface ValidationResult {
  data: ExtractedData;
  issues: ValidationIssue[];
  status: DocumentStatus;
}

export async function runValidation(
  opts: RunValidationOptions,
): Promise<ValidationResult> {
  const { data, userId, documentId, db } = opts;

  const { data: enrichedData, issues: enrichmentIssues } = autoComputeTotal(data);

  const issues: ValidationIssue[] = [
    ...enrichmentIssues,
    ...checkRequiredFields(enrichedData),
    ...checkTotal(enrichedData),
    ...checkDates(enrichedData),
    ...checkLineItems(enrichedData),
  ];

  if (enrichedData.documentNumber) {
    const dupSnap = await db
      .collection("users")
      .doc(userId)
      .collection("documents")
      .where("documentNumber", "==", enrichedData.documentNumber)
      .limit(2)
      .get();

    const otherDup = dupSnap.docs.find((d) => d.id !== documentId);
    if (otherDup) {
      issues.push(buildDuplicateIssue(enrichedData.documentNumber));
    }
  }

  return { data: enrichedData, issues, status: deriveStatus(issues) };
}

export function deriveStatus(issues: ValidationIssue[]): DocumentStatus {
  if (issues.some((i) => i.severity === "error")) return "needs_review";
  if (issues.length === 0) return "validated";
  return "needs_review";
}
