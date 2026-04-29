"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { uploadAndExtract } from "@/lib/upload";
import { formatFileSize, cn } from "@/lib/utils";

type ItemStatus = "pending" | "uploading" | "extracting" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  status: ItemStatus;
  documentId?: string;
  errorMessage?: string;
}

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
};

export function UploadDropzone() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!user) return;

      const newItems: UploadItem[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
      }));

      setItems((prev) => [...newItems, ...prev]);

      for (const item of newItems) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "uploading" } : it,
          ),
        );

        try {
          const result = await uploadAndExtract(user, item.file);
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    documentId: result.documentId,
                    status: result.status === "extracted" ? "done" : "error",
                    errorMessage: result.errorMessage,
                  }
                : it,
            ),
          );
        } catch (err) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: "error",
                    errorMessage: err instanceof Error ? err.message : "Failed",
                  }
                : it,
            ),
          );
        }
      }
    },
    [user],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 px-4 py-10 text-center transition-colors hover:bg-muted/40 sm:px-6 sm:py-16",
          isDragActive && "border-primary bg-primary/5",
        )}
      >
        <input {...getInputProps()} />
        <CloudUpload className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-base font-medium">
          {isDragActive ? "Drop files to upload" : "Drag and drop files here"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse · PDF, PNG, JPG, CSV, TXT · max 20 MB
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <UploadRow key={item.id} item={item} onOpen={(id) => router.push(`/documents/${id}`)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UploadRow({
  item,
  onOpen,
}: {
  item: UploadItem;
  onOpen: (documentId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-4 py-3">
      <div className="flex items-center gap-3 truncate">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(item.file.size)} · {statusLabel(item.status)}
            {item.errorMessage ? ` · ${item.errorMessage}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusIcon status={item.status} />
        {item.status === "done" && item.documentId ? (
          <Button size="sm" variant="outline" onClick={() => onOpen(item.documentId!)}>
            Review
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(status: ItemStatus): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "uploading":
      return "Uploading…";
    case "extracting":
      return "Extracting…";
    case "done":
      return "Ready for review";
    case "error":
      return "Failed";
  }
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === "error") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "pending") return <div className="h-5 w-5" />;
  return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
}
