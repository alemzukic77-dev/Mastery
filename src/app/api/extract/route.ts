import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { extract } from "@/lib/extractors";
import { runValidation } from "@/lib/validation/runner";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ExtractedData } from "@/lib/types";
import {
  aggregateInputsFromDoc,
  applyAggregateDelta,
} from "@/lib/aggregates";
import { checkAndIncrementRateLimit, RateLimitError } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 },
      );
    }

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }
    const userId = decoded.uid;

    try {
      await checkAndIncrementRateLimit(userId);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json(
          {
            error: `Premašen limit zahtjeva (${err.window}, max ${err.limit}). Pokušaj ponovo za ~${err.retryAfterSec}s.`,
            window: err.window,
            retryAfterSec: err.retryAfterSec,
          },
          {
            status: 429,
            headers: { "Retry-After": String(err.retryAfterSec) },
          },
        );
      }
      throw err;
    }

    const body = (await req.json()) as { documentId?: string };
    const documentId = body.documentId;
    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 },
      );
    }

    const db = adminDb();
    const docRef = db
      .collection("users")
      .doc(userId)
      .collection("documents")
      .doc(documentId);

    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const data = snap.data();
    const original = data?.originalFile as
      | {
          storagePath?: string;
          contentType?: string;
          fileName?: string;
          size?: number;
          downloadUrl?: string | null;
        }
      | undefined;

    if (!original?.storagePath) {
      return NextResponse.json(
        { error: "Document is missing original file reference" },
        { status: 400 },
      );
    }

    const isFirstExtraction = data?.documentIndex === undefined;

    const bucket = adminStorage().bucket();
    const [fileBuffer] = await bucket.file(original.storagePath).download();

    if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (fileBuffer.byteLength / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        {
          error: `Fajl prevelik (${sizeMb}MB). Maksimum je ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
        },
        { status: 413 },
      );
    }

    let extracted;
    try {
      extracted = await extract({
        buffer: fileBuffer,
        mimeType: original.contentType ?? "",
        fileName: original.fileName ?? "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed";
      const before = aggregateInputsFromDoc(data);
      const failurePatch = {
        status: "needs_review" as const,
        validationIssues: [
          {
            field: "_extractor",
            severity: "error" as const,
            message,
            code: "EXTRACTION_FAILED" as const,
          },
        ],
        updatedAt: FieldValue.serverTimestamp(),
      };
      await docRef.update(failurePatch);
      const after = aggregateInputsFromDoc({
        ...data,
        ...failurePatch,
      });
      await applyAggregateDelta(db, userId, before, after);
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const docs = extracted.documents;

    // Always update the primary doc with the first extraction
    const primary = await persistDocument({
      db,
      userId,
      docRef,
      beforeData: data,
      extractedData: docs[0],
      raw: extracted.raw,
      documentIndex: 0,
    });

    // If multi-doc AND this is the first extraction (not a re-extract), create siblings
    const siblingIds: string[] = [documentId];
    if (docs.length > 1 && isFirstExtraction) {
      for (let i = 1; i < docs.length; i++) {
        const newDocRef = db
          .collection("users")
          .doc(userId)
          .collection("documents")
          .doc();

        const initial = {
          originalFile: original,
          status: "uploaded" as const,
          validationIssues: [],
          total: null,
          currency: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await newDocRef.create(initial);
        await applyAggregateDelta(
          db,
          userId,
          null,
          aggregateInputsFromDoc(initial),
        );

        await persistDocument({
          db,
          userId,
          docRef: newDocRef,
          beforeData: initial,
          extractedData: docs[i],
          raw: extracted.raw,
          documentIndex: i,
        });

        siblingIds.push(newDocRef.id);
      }

      // Now patch every doc with siblingIds (only when there are siblings)
      const batch = db.batch();
      for (const sid of siblingIds) {
        batch.update(
          db
            .collection("users")
            .doc(userId)
            .collection("documents")
            .doc(sid),
          { siblingIds, updatedAt: FieldValue.serverTimestamp() },
        );
      }
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      documentId,
      status: primary.status,
      issuesCount: primary.issuesCount,
      extractedCount: docs.length,
      siblingIds: docs.length > 1 ? siblingIds : undefined,
    });
  } catch (err) {
    console.error("[/api/extract]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface PersistOpts {
  db: Firestore;
  userId: string;
  docRef: FirebaseFirestore.DocumentReference;
  beforeData: FirebaseFirestore.DocumentData | undefined;
  extractedData: ExtractedData;
  raw: unknown;
  documentIndex: number;
}

async function persistDocument(
  opts: PersistOpts,
): Promise<{ status: string; issuesCount: number }> {
  const { db, userId, docRef, beforeData, extractedData, raw, documentIndex } =
    opts;

  const validation = await runValidation({
    data: extractedData,
    userId,
    documentId: docRef.id,
    db,
  });

  const updatePayload = {
    ...validation.data,
    rawExtraction: raw,
    validationIssues: validation.issues,
    status: validation.status,
    documentIndex,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await docRef.update(updatePayload);

  const before = aggregateInputsFromDoc(beforeData);
  const after = aggregateInputsFromDoc({
    ...beforeData,
    ...validation.data,
    validationIssues: validation.issues,
    status: validation.status,
  });
  await applyAggregateDelta(db, userId, before, after);

  return {
    status: validation.status,
    issuesCount: validation.issues.length,
  };
}
