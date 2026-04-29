"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { IssueChips } from "@/components/documents/IssueChips";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedDocuments } from "@/hooks/usePaginatedDocuments";
import type { DocumentStatus, ProcessedDocument } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const PAGE_SIZE = 10;

const STATUS_FILTERS: Array<{ value: DocumentStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "validated", label: "Validated" },
  { value: "rejected", label: "Rejected" },
  { value: "uploaded", label: "Uploaded" },
];

export function DocumentsTable() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentStatus | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    docs,
    pageIndex,
    hasNext,
    hasPrev,
    loading,
    error,
    nextPage,
    prevPage,
  } = usePaginatedDocuments({ pageSize: PAGE_SIZE, status: filter });

  const visible = search
    ? docs.filter((d) => {
        const q = search.toLowerCase();
        const haystack = [
          d.documentNumber,
          d.supplier,
          d.originalFile.fileName,
          d.currency,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    : docs;

  async function handleDelete(doc: ProcessedDocument) {
    if (!user) return;
    const label =
      doc.documentNumber || doc.originalFile.fileName || doc.id.slice(0, 8);
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;

    setDeletingId(doc.id);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        alert(`Delete failed: ${json.error ?? res.statusText}`);
      }
    } catch (err) {
      alert(
        `Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search current page…"
            className="pl-9"
          />
        </div>
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilter(s.value)}
              className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                filter === s.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && docs.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border bg-muted/20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {search
            ? "No matches on this page. Try a different page or clear the search."
            : "No documents match your filter."}
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {visible.map((doc) => {
              const label =
                doc.documentNumber ||
                doc.originalFile.fileName ||
                doc.id.slice(0, 8);
              const typeLabel =
                doc.type === "purchase_order"
                  ? "PO"
                  : doc.type === "invoice"
                    ? "Invoice"
                    : "—";
              return (
                <div
                  key={doc.id}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="block truncate font-medium text-foreground hover:underline"
                      >
                        {label}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel}
                        {doc.supplier ? ` · ${doc.supplier}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(doc.issueDate)}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(doc.total, doc.currency)}
                    </span>
                  </div>

                  {doc.validationIssues && doc.validationIssues.length > 0 ? (
                    <div className="mt-3">
                      <IssueChips issues={doc.validationIssues} max={2} />
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      title="Open / edit"
                    >
                      <Link href={`/documents/${doc.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Open</span>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Issue date</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Issues</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-background">
              {visible.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/40">
                  <td className="px-5 py-4">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {doc.documentNumber ||
                        doc.originalFile.fileName ||
                        doc.id.slice(0, 8)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {doc.type === "purchase_order"
                        ? "PO"
                        : doc.type === "invoice"
                          ? "Invoice"
                          : "—"}
                    </p>
                  </td>
                  <td className="px-5 py-4">{doc.supplier || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                    {formatDate(doc.issueDate)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium">
                    {formatCurrency(doc.total, doc.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-5 py-4">
                    <IssueChips issues={doc.validationIssues} max={2} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title="Open / edit"
                      >
                        <Link href={`/documents/${doc.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Open</span>
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.id}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {pageIndex + 1}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={!hasPrev || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={!hasNext || loading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
