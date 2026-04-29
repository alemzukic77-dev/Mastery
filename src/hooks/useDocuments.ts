"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ProcessedDocument } from "@/lib/types";
import { useAuth } from "./useAuth";

export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "users", user.uid, "documents"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => normalize(d.id, d.data()));
        setDocuments(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  return { documents, loading, error };
}

function normalize(id: string, data: DocumentData): ProcessedDocument {
  return {
    id,
    type: data.type ?? "unknown",
    supplier: data.supplier ?? null,
    documentNumber: data.documentNumber ?? null,
    issueDate: data.issueDate ?? null,
    dueDate: data.dueDate ?? null,
    currency: data.currency ?? null,
    lineItems: Array.isArray(data.lineItems) ? data.lineItems : [],
    subtotal: data.subtotal ?? null,
    tax: data.tax ?? null,
    total: data.total ?? null,
    status: data.status ?? "uploaded",
    validationIssues: Array.isArray(data.validationIssues)
      ? data.validationIssues
      : [],
    originalFile: data.originalFile ?? {
      storagePath: "",
      contentType: "",
      size: 0,
      fileName: "",
    },
    rawExtraction: data.rawExtraction,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    validatedAt: data.validatedAt ? toIso(data.validatedAt) : undefined,
  };
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      // Firestore Timestamp
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}
