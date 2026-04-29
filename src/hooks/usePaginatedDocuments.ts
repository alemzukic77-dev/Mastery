"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { DocumentStatus, ProcessedDocument } from "@/lib/types";
import { useAuth } from "./useAuth";

interface Options {
  pageSize?: number;
  status?: DocumentStatus | "all";
}

interface PageState {
  docs: ProcessedDocument[];
  /** Cursor of the last item on this page (for fetching the next page). */
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
}

/**
 * Cursor-based pagination over `users/{uid}/documents`. Subscribes to the
 * current page only via onSnapshot, so reads scale with the visible window
 * (pageSize) instead of the entire collection.
 */
export function usePaginatedDocuments({
  pageSize = 10,
  status = "all",
}: Options = {}) {
  const { user, loading: authLoading } = useAuth();
  // cursors[i] = the doc to startAfter to fetch page i (so cursors[0] is null).
  const [cursors, setCursors] = useState<
    Array<QueryDocumentSnapshot<DocumentData> | null>
  >([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<PageState>({ docs: [], lastCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset cursors when the filter changes — adjust state during render
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [prevFilter, setPrevFilter] = useState({ status, pageSize });
  if (prevFilter.status !== status || prevFilter.pageSize !== pageSize) {
    setPrevFilter({ status, pageSize });
    setCursors([null]);
    setPageIndex(0);
  }

  const cursor = cursors[pageIndex] ?? null;

  // Build the query for the current page.
  const queryRef = useMemo(() => {
    if (!user) return null;
    const constraints: QueryConstraint[] = [];
    if (status !== "all") constraints.push(where("status", "==", status));
    constraints.push(orderBy("createdAt", "desc"));
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));
    return query(
      collection(db, "users", user.uid, "documents"),
      ...constraints,
    );
  }, [user, status, pageSize, cursor]);

  useEffect(() => {
    if (!queryRef) return;
    // Briefly mark loading until the next snapshot resolves; intentional
    // mirror of an external (Firestore) subscription state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const unsubscribe = onSnapshot(
      queryRef,
      (snap) => {
        const docs = snap.docs.map((d) => normalize(d.id, d.data()));
        const lastCursor =
          snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        setPage({ docs, lastCursor });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [queryRef]);

  function nextPage() {
    if (page.docs.length < pageSize || !page.lastCursor) return;
    const nextIndex = pageIndex + 1;
    const lastCursor = page.lastCursor;
    setCursors((prev) => {
      const copy = prev.slice();
      copy[nextIndex] = lastCursor;
      return copy;
    });
    setPageIndex(nextIndex);
  }

  function prevPage() {
    if (pageIndex === 0) return;
    setPageIndex(pageIndex - 1);
  }

  return {
    docs: page.docs,
    pageIndex,
    pageSize,
    hasNext: page.docs.length === pageSize,
    hasPrev: pageIndex > 0,
    loading: authLoading || (loading && !!user),
    error,
    nextPage,
    prevPage,
  };
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
    documentIndex:
      typeof data.documentIndex === "number" ? data.documentIndex : undefined,
    siblingIds: Array.isArray(data.siblingIds)
      ? (data.siblingIds as string[])
      : undefined,
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
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}
