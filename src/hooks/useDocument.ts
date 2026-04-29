"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ProcessedDocument } from "@/lib/types";
import { useAuth } from "./useAuth";

export function useDocument(documentId: string | null) {
  const { user } = useAuth();
  const [document, setDocument] = useState<ProcessedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !documentId) {
      setDocument(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", user.uid, "documents", documentId);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setDocument(null);
          setError("Document not found");
        } else {
          const data = snap.data();
          setDocument({
            id: snap.id,
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
            createdAt:
              typeof data.createdAt?.toDate === "function"
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
            updatedAt:
              typeof data.updatedAt?.toDate === "function"
                ? data.updatedAt.toDate().toISOString()
                : new Date().toISOString(),
            validatedAt:
              typeof data.validatedAt?.toDate === "function"
                ? data.validatedAt.toDate().toISOString()
                : undefined,
          });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user, documentId]);

  return { document, loading, error };
}
