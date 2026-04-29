"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocument } from "@/hooks/useDocument";
import { OriginalFileViewer } from "./OriginalFileViewer";
import { ReviewForm } from "./ReviewForm";
import { SiblingNav } from "./SiblingNav";
import { StatusBadge } from "./StatusBadge";
import { ValidationPanel } from "./ValidationPanel";
import { formatDate } from "@/lib/utils";

export function DocumentReview({ documentId }: { documentId: string }) {
  const { document, loading, error } = useDocument(documentId);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error ?? "Document not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {document.documentNumber || "Untitled document"}
            </h1>
            <StatusBadge status={document.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {document.supplier || "Unknown supplier"} · Uploaded{" "}
            {formatDate(document.createdAt)}
          </p>
        </div>
      </div>

      <SiblingNav document={document} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <OriginalFileViewer file={document.originalFile} />
        </div>

        <div className="space-y-6">
          <ValidationPanel issues={document.validationIssues} />
          <ReviewForm document={document} />
        </div>
      </div>
    </div>
  );
}
