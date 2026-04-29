"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProcessedDocument } from "@/lib/types";

export function SiblingNav({ document }: { document: ProcessedDocument }) {
  const siblingIds = document.siblingIds;
  if (!siblingIds || siblingIds.length <= 1) return null;

  const currentIndex = siblingIds.indexOf(document.id);
  const prevId = currentIndex > 0 ? siblingIds[currentIndex - 1] : null;
  const nextId =
    currentIndex >= 0 && currentIndex < siblingIds.length - 1
      ? siblingIds[currentIndex + 1]
      : null;

  const ordinal =
    typeof document.documentIndex === "number"
      ? document.documentIndex + 1
      : currentIndex + 1;

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <FileStack className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          Document {ordinal} of {siblingIds.length}
        </span>
        <span className="text-muted-foreground">extracted from same file</span>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm" disabled={!prevId}>
          {prevId ? (
            <Link href={`/documents/${prevId}`}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          ) : (
            <span>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </span>
          )}
        </Button>
        <Button asChild variant="ghost" size="sm" disabled={!nextId}>
          {nextId ? (
            <Link href={`/documents/${nextId}`}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span>
              Next
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
