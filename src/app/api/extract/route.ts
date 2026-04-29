import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { extract } from "@/lib/extractors";
import { runValidation } from "@/lib/validation/runner";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const maxDuration = 60;

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
        }
      | undefined;

    if (!original?.storagePath) {
      return NextResponse.json(
        { error: "Document is missing original file reference" },
        { status: 400 },
      );
    }

    const bucket = adminStorage().bucket();
    const [fileBuffer] = await bucket.file(original.storagePath).download();

    let extracted;
    try {
      extracted = await extract({
        buffer: fileBuffer,
        mimeType: original.contentType ?? "",
        fileName: original.fileName ?? "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed";
      await docRef.update({
        status: "needs_review",
        validationIssues: [
          {
            field: "_extractor",
            severity: "error",
            message,
            code: "EXTRACTION_FAILED",
          },
        ],
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const validation = await runValidation({
      data: extracted.data,
      userId,
      documentId,
      db,
    });

    await docRef.update({
      ...extracted.data,
      rawExtraction: extracted.raw,
      validationIssues: validation.issues,
      status: validation.status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      documentId,
      status: validation.status,
      issuesCount: validation.issues.length,
    });
  } catch (err) {
    console.error("[/api/extract]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
