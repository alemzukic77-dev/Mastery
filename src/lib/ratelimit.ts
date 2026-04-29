import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase/admin";

const LIMITS = {
  minute: { max: 30, durationMs: 60_000 },
  hour: { max: 60, durationMs: 60 * 60_000 },
  day: { max: 150, durationMs: 24 * 60 * 60_000 },
} as const;

type WindowKey = keyof typeof LIMITS;

export class RateLimitError extends Error {
  readonly window: WindowKey;
  readonly retryAfterSec: number;
  readonly limit: number;
  constructor(window: WindowKey, retryAfterSec: number, limit: number) {
    super(`Rate limit exceeded for window: ${window}`);
    this.name = "RateLimitError";
    this.window = window;
    this.retryAfterSec = retryAfterSec;
    this.limit = limit;
  }
}

interface WindowState {
  count: number;
  resetAt: Timestamp;
}

interface RateLimitDoc {
  minute: WindowState;
  hour: WindowState;
  day: WindowState;
  lastRequestAt: Timestamp;
}

export async function checkAndIncrementRateLimit(uid: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    const nowMs = now.toMillis();
    const existing = snap.data() as RateLimitDoc | undefined;

    const next: RateLimitDoc = {
      minute: stepWindow("minute", existing?.minute, nowMs),
      hour: stepWindow("hour", existing?.hour, nowMs),
      day: stepWindow("day", existing?.day, nowMs),
      lastRequestAt: now,
    };

    for (const key of ["minute", "hour", "day"] as const) {
      const w = next[key];
      if (w.count + 1 > LIMITS[key].max) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((w.resetAt.toMillis() - nowMs) / 1000),
        );
        throw new RateLimitError(key, retryAfterSec, LIMITS[key].max);
      }
    }

    next.minute.count += 1;
    next.hour.count += 1;
    next.day.count += 1;

    tx.set(ref, next);
  });
}

function stepWindow(
  key: WindowKey,
  current: WindowState | undefined,
  nowMs: number,
): WindowState {
  if (!current || current.resetAt.toMillis() <= nowMs) {
    return {
      count: 0,
      resetAt: Timestamp.fromMillis(nowMs + LIMITS[key].durationMs),
    };
  }
  return current;
}
