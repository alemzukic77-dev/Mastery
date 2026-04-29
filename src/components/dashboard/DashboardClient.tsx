"use client";

import { useDocuments } from "@/hooks/useDocuments";
import { Loader2 } from "lucide-react";

export function DashboardClient() {
  const { documents, loading, error } = useDocuments();

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Failed to load documents: {error}
      </p>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
        <h3 className="text-lg font-semibold">No documents yet</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Upload your first invoice or purchase order to start extracting and
          validating data.
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      {documents.length} document(s) loaded.
    </div>
  );
}
