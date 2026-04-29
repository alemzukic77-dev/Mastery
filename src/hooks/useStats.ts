"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { DocumentStatus } from "@/lib/types";
import { useAuth } from "./useAuth";

export interface AggregateStats {
  totalCount: number;
  byStatus: Record<DocumentStatus, number>;
  openIssuesCount: number;
  validatedTotalsByCurrency: Record<string, { amount: number; count: number }>;
}

const ZERO: AggregateStats = {
  totalCount: 0,
  byStatus: { uploaded: 0, needs_review: 0, validated: 0, rejected: 0 },
  openIssuesCount: 0,
  validatedTotalsByCurrency: {},
};

export function useStats() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recomputedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid, "aggregates", "summary");
    const unsubscribe = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          if (!recomputedRef.current) {
            recomputedRef.current = true;
            try {
              const idToken = await user.getIdToken();
              const res = await fetch("/api/aggregates/recompute", {
                method: "POST",
                headers: { Authorization: `Bearer ${idToken}` },
              });
              if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                  error?: string;
                };
                setError(
                  body.error ?? `Recompute failed (${res.status})`,
                );
                setStats(ZERO);
              }
              // On success, the server wrote the aggregate doc, so onSnapshot
              // will fire again with snap.exists() === true and we'll setStats
              // there. Nothing more to do here.
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Recompute failed",
              );
              setStats(ZERO);
            }
            return;
          }
          setStats(ZERO);
          return;
        }
        const data = snap.data() as Partial<AggregateStats>;
        setStats({
          totalCount: data.totalCount ?? 0,
          byStatus: { ...ZERO.byStatus, ...(data.byStatus ?? {}) },
          openIssuesCount: data.openIssuesCount ?? 0,
          validatedTotalsByCurrency: data.validatedTotalsByCurrency ?? {},
        });
        setError(null);
      },
      (err) => setError(err.message),
    );
    return () => unsubscribe();
  }, [user]);

  return {
    stats: user ? stats : null,
    loading: authLoading || (!!user && stats === null && error === null),
    error,
  };
}
