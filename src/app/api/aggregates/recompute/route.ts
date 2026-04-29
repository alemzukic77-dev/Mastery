import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { recomputeAggregates } from "@/lib/aggregates";

export const runtime = "nodejs";

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

  const stats = await recomputeAggregates(adminDb(), userId);
  return NextResponse.json({ ok: true, stats });
}
