import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { DocumentStatus } from "@/lib/types";

export const AGGREGATE_DOC_PATH = "aggregates/summary" as const;

export interface AggregateInputs {
  status: DocumentStatus;
  validationIssuesCount: number;
  total: number | null;
  currency: string | null;
}

/** Numeric snapshot used for delta computation. `null` = the doc doesn't exist (creation/deletion). */
export type AggregateState = AggregateInputs | null;

export interface AggregateStats {
  totalCount: number;
  byStatus: Record<DocumentStatus, number>;
  openIssuesCount: number;
  validatedTotalsByCurrency: Record<string, { amount: number; count: number }>;
}

const ZERO_STATS: AggregateStats = {
  totalCount: 0,
  byStatus: { uploaded: 0, needs_review: 0, validated: 0, rejected: 0 },
  openIssuesCount: 0,
  validatedTotalsByCurrency: {},
};

export function aggregateInputsFromDoc(
  data: Record<string, unknown> | undefined,
): AggregateInputs | null {
  if (!data) return null;
  return {
    status: (data.status as DocumentStatus | undefined) ?? "uploaded",
    validationIssuesCount: Array.isArray(data.validationIssues)
      ? (data.validationIssues as unknown[]).length
      : 0,
    total: typeof data.total === "number" ? data.total : null,
    currency: typeof data.currency === "string" ? data.currency : null,
  };
}

/**
 * Apply a delta to the aggregate doc by writing increment-merge patches.
 * Pass `before=null` for creates, `after=null` for deletes.
 */
export function aggregatePatch(
  before: AggregateState,
  after: AggregateState,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  // total count
  const totalDiff = (after ? 1 : 0) - (before ? 1 : 0);
  if (totalDiff !== 0) patch.totalCount = FieldValue.increment(totalDiff);

  // byStatus map
  const byStatus: Record<string, unknown> = {};
  if (before) byStatus[before.status] = FieldValue.increment(-1);
  if (after) {
    byStatus[after.status] =
      after.status === before?.status
        ? FieldValue.increment(0)
        : FieldValue.increment(1);
  }
  // remove no-op entries (e.g. status unchanged → both -1 and +1 cancel)
  for (const k of Object.keys(byStatus)) {
    if (before && after && before.status === after.status) {
      delete byStatus[k];
    }
  }
  if (Object.keys(byStatus).length > 0) patch.byStatus = byStatus;

  // open issues
  const issuesDiff =
    (after?.validationIssuesCount ?? 0) - (before?.validationIssuesCount ?? 0);
  if (issuesDiff !== 0)
    patch.openIssuesCount = FieldValue.increment(issuesDiff);

  // validated totals by currency
  const totals: Record<string, { amount: unknown; count: unknown }> = {};
  const beforeContrib =
    before?.status === "validated" &&
    before.currency &&
    typeof before.total === "number"
      ? { currency: before.currency, amount: before.total }
      : null;
  const afterContrib =
    after?.status === "validated" &&
    after.currency &&
    typeof after.total === "number"
      ? { currency: after.currency, amount: after.total }
      : null;

  if (beforeContrib) {
    totals[beforeContrib.currency] = {
      amount: FieldValue.increment(-beforeContrib.amount),
      count: FieldValue.increment(-1),
    };
  }
  if (afterContrib) {
    if (
      beforeContrib &&
      beforeContrib.currency === afterContrib.currency &&
      beforeContrib.amount === afterContrib.amount
    ) {
      delete totals[afterContrib.currency];
    } else if (beforeContrib && beforeContrib.currency === afterContrib.currency) {
      totals[afterContrib.currency] = {
        amount: FieldValue.increment(afterContrib.amount - beforeContrib.amount),
        count: FieldValue.increment(0),
      };
    } else {
      totals[afterContrib.currency] = {
        amount: FieldValue.increment(afterContrib.amount),
        count: FieldValue.increment(1),
      };
    }
  }
  if (Object.keys(totals).length > 0) patch.validatedTotalsByCurrency = totals;

  if (Object.keys(patch).length === 0) return null;
  patch.updatedAt = FieldValue.serverTimestamp();
  return patch;
}

/** Convenience: write the patch under `users/{uid}/aggregates/summary`. */
export async function applyAggregateDelta(
  db: Firestore,
  userId: string,
  before: AggregateState,
  after: AggregateState,
): Promise<void> {
  const patch = aggregatePatch(before, after);
  if (!patch) return;
  await db
    .collection("users")
    .doc(userId)
    .collection("aggregates")
    .doc("summary")
    .set(patch, { merge: true });
}

/** Recompute aggregates from scratch by scanning the user's documents collection. */
export async function recomputeAggregates(
  db: Firestore,
  userId: string,
): Promise<AggregateStats> {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("documents")
    .get();

  const stats: AggregateStats = {
    totalCount: snap.size,
    byStatus: { ...ZERO_STATS.byStatus },
    openIssuesCount: 0,
    validatedTotalsByCurrency: {},
  };

  for (const doc of snap.docs) {
    const data = doc.data();
    const status = (data.status ?? "uploaded") as DocumentStatus;
    stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
    if (Array.isArray(data.validationIssues)) {
      stats.openIssuesCount += data.validationIssues.length;
    }
    if (
      status === "validated" &&
      typeof data.total === "number" &&
      typeof data.currency === "string"
    ) {
      const slot = stats.validatedTotalsByCurrency[data.currency] ?? {
        amount: 0,
        count: 0,
      };
      slot.amount += data.total;
      slot.count += 1;
      stats.validatedTotalsByCurrency[data.currency] = slot;
    }
  }

  await db
    .collection("users")
    .doc(userId)
    .collection("aggregates")
    .doc("summary")
    .set(
      {
        ...stats,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

  return stats;
}
