"use client";

import { useEffect, useState } from "react";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { FileText, Loader2 } from "lucide-react";
import Image from "next/image";
import { storage } from "@/lib/firebase/client";
import type { OriginalFileMeta } from "@/lib/types";
import { detectFileKind, formatFileSize } from "@/lib/utils";

export function OriginalFileViewer({ file }: { file: OriginalFileMeta }) {
  const [url, setUrl] = useState<string | null>(file.downloadUrl ?? null);
  const [loading, setLoading] = useState(!file.downloadUrl && !!file.storagePath);

  useEffect(() => {
    if (!file.storagePath || file.downloadUrl) return;
    let cancelled = false;
    getDownloadURL(storageRef(storage, file.storagePath))
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file.storagePath, file.downloadUrl]);

  const kind = detectFileKind(file.contentType, file.fileName);

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.fileName || "Original file"}</p>
          <p className="text-xs text-muted-foreground">
            {file.contentType || "—"} · {formatFileSize(file.size)}
          </p>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open
          </a>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : !url ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8" />
            File preview unavailable
          </div>
        ) : kind === "pdf" ? (
          <iframe
            src={url}
            title="Document preview"
            className="h-full min-h-[600px] w-full rounded border"
          />
        ) : kind === "image" ? (
          <div className="relative h-full min-h-[400px] w-full">
            <Image
              src={url}
              alt={file.fileName}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="h-8 w-8" />
            Open original file
          </a>
        )}
      </div>
    </div>
  );
}
