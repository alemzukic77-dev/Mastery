"use client";

import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
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
  const userDocsCol = collection(db, "users", user.uid, "documents");

  const docRef = await addDoc(userDocsCol, {
    status: "uploaded",
    type: "unknown",
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
    originalFile: {
      storagePath: "",
      contentType: file.type,
      size: file.size,
      fileName: file.name,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const documentId = docRef.id;
  const storagePath = `users/${user.uid}/documents/${documentId}/${file.name}`;
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

  const downloadUrl = await getDownloadURL(storageRef).catch(() => null);

  await updateDoc(doc(db, "users", user.uid, "documents", documentId), {
    "originalFile.storagePath": storagePath,
    "originalFile.downloadUrl": downloadUrl,
    updatedAt: serverTimestamp(),
  });

  const idToken = await user.getIdToken();
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
