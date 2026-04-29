"use client";

import Link from "next/link";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStats } from "@/hooks/useStats";
import { DocumentsTable } from "./DocumentsTable";
import { StatsCards } from "./StatsCards";

export function DashboardClient() {
  const { stats, loading, error } = useStats();

  if (loading || !stats) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Failed to load stats: {error}
      </p>
    );
  }

  if (stats.totalCount === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
        <h3 className="text-lg font-semibold">No documents yet</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Upload your first invoice or purchase order to start extracting and
          validating data.
        </p>
        <Button asChild className="mt-6">
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            Upload documents
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StatsCards stats={stats} />
      <DocumentsTable />
    </div>
  );
}
