"use client";

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import { db, storage } from "@/lib/firebase/client";

interface UploadResult {
  documentId: string;
  status: "uploaded" | "extracted" | "failed";
  errorMessage?: string;
}

export async function uploadAndExtract(
  user: User,
  file: File,
): Promise<UploadResult> {
  const idToken = await user.getIdToken();

  // 1) Server creates the Firestore doc + bumps aggregates atomically.
  const createRes = await fetch("/api/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  if (!createRes.ok) {
    const err = (await createRes.json().catch(() => ({}))) as { error?: string };
    return {
      documentId: "",
      status: "failed",
      errorMessage: err.error ?? `Create failed (${createRes.status})`,
    };
  }
  const { id: documentId, storagePath } = (await createRes.json()) as {
    id: string;
    storagePath: string;
  };

  // 2) Client uploads the actual file to the predetermined storage path.
  const storageRef = ref(storage, storagePath);
  try {
    await uploadBytes(storageRef, file, { contentType: file.type });
  } catch (err) {
    return {
      documentId,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Upload failed",
    };
  }

  // 3) Backfill the downloadUrl on the doc (client-allowed update; doesn't
  // affect aggregates).
  const downloadUrl = await getDownloadURL(storageRef).catch(() => null);
  await updateDoc(doc(db, "users", user.uid, "documents", documentId), {
    "originalFile.downloadUrl": downloadUrl,
    updatedAt: serverTimestamp(),
  });

  // 4) Trigger extraction.
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ documentId }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    return {
      documentId,
      status: "failed",
      errorMessage: errorBody.error ?? `Extraction failed (${response.status})`,
    };
  }

  return { documentId, status: "extracted" };
}
