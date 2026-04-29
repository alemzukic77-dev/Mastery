import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  aggregateInputsFromDoc,
  aggregatePatch,
} from "@/lib/aggregates";

export const runtime = "nodejs";

interface CreateBody {
  fileName?: string;
  contentType?: string;
  size?: number;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    userId = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const size = typeof body.size === "number" ? body.size : 0;
  if (!fileName) {
    return NextResponse.json(
      { error: "fileName is required" },
      { status: 400 },
    );
  }

  const db = adminDb();
  const docRef = db
    .collection("users")
    .doc(userId)
    .collection("documents")
    .doc();

  const storagePath = `users/${userId}/documents/${docRef.id}/${fileName}`;

  const initialDoc = {
    status: "uploaded" as const,
    type: "unknown" as const,
    supplier: null,
    documentNumber: null,
    issueDate: null,
    dueDate: null,
    currency: null,
    lineItems: [],
    subtotal: null,
    tax: null,
    total: null,
    validationIssues: [],
    originalFile: { storagePath, contentType, size, fileName },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const aggregateRef = db
    .collection("users")
    .doc(userId)
    .collection("aggregates")
    .doc("summary");

  const patch = aggregatePatch(null, aggregateInputsFromDoc(initialDoc));

  const batch = db.batch();
  batch.create(docRef, initialDoc);
  if (patch) batch.set(aggregateRef, patch, { merge: true });
  await batch.commit();

  return NextResponse.json({ id: docRef.id, storagePath });
}
