import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type {
  DocumentStatus,
  ExtractedData,
  ValidationIssue,
} from "@/lib/types";
import {
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
  issues: ValidationIssue[];
  status: DocumentStatus;
}

export async function runValidation(
  opts: RunValidationOptions,
): Promise<ValidationResult> {
  const { data, userId, documentId, db } = opts;

  const issues: ValidationIssue[] = [
    ...checkRequiredFields(data),
    ...checkTotal(data),
    ...checkDates(data),
    ...checkLineItems(data),
  ];

  if (data.documentNumber) {
    const dupSnap = await db
      .collection("users")
      .doc(userId)
      .collection("documents")
      .where("documentNumber", "==", data.documentNumber)
      .limit(2)
      .get();

    const otherDup = dupSnap.docs.find((d) => d.id !== documentId);
    if (otherDup) {
      issues.push(buildDuplicateIssue(data.documentNumber));
    }
  }

  return { issues, status: deriveStatus(issues) };
}

export function deriveStatus(issues: ValidationIssue[]): DocumentStatus {
  return issues.length === 0 ? "validated" : "needs_review";
}
