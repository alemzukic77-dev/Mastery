import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { extractedDataSchema } from "@/lib/validation/schemas";
import { runValidation } from "@/lib/validation/runner";
import type { DocumentStatus } from "@/lib/types";

export const runtime = "nodejs";

async function authenticate(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!idToken) throw new Response("Missing token", { status: 401 });
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new Response("Invalid token", { status: 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticate(req);
    const { id } = await context.params;
    const body = (await req.json()) as {
      data?: unknown;
      action?: "confirm" | "reject";
    };

    const db = adminDb();
    const docRef = db
      .collection("users")
      .doc(userId)
      .collection("documents")
      .doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.action === "reject") {
      await docRef.update({
        status: "rejected" satisfies DocumentStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (body.action === "confirm") {
      await docRef.update({
        status: "validated" satisfies DocumentStatus,
        validatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, status: "validated" });
    }

    if (body.data !== undefined) {
      const parsed = extractedDataSchema.safeParse(body.data);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid extracted data shape", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      const validation = await runValidation({
        data: parsed.data,
        userId,
        documentId: id,
        db,
      });

      await docRef.update({
        ...validation.data,
        validationIssues: validation.issues,
        status: validation.status,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        ok: true,
        status: validation.status,
        issuesCount: validation.issues.length,
      });
    }

    return NextResponse.json(
      { error: "No action or data provided" },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/documents/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticate(req);
    const { id } = await context.params;
    const db = adminDb();
    const docRef = db
      .collection("users")
      .doc(userId)
      .collection("documents")
      .doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = snap.data();
    const storagePath = data?.originalFile?.storagePath as string | undefined;
    if (storagePath) {
      await adminStorage()
        .bucket()
        .file(storagePath)
        .delete()
        .catch(() => null);
    }
    await docRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
