"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { IssueChips } from "@/components/documents/IssueChips";
import { useAuth } from "@/hooks/useAuth";
import type { DocumentStatus, ProcessedDocument } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: DocumentStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "validated", label: "Validated" },
  { value: "rejected", label: "Rejected" },
  { value: "uploaded", label: "Uploaded" },
];

export function DocumentsTable({
  documents,
}: {
  documents: ProcessedDocument[];
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentStatus | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = documents.filter((d) => {
    if (filter !== "all" && d.status !== filter) return false;
    if (search) {
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
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  async function handleDelete(doc: ProcessedDocument) {
    if (!user) return;
    const label = doc.documentNumber || doc.originalFile.fileName || doc.id.slice(0, 8);
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
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier, number, file…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilter(s.value)}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors ${
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          No documents match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Supplier</th>
                <th className="px-4 py-2.5 font-medium">Issue date</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Issues</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-background">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">{doc.supplier || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(doc.issueDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(doc.total, doc.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3">
                    <IssueChips issues={doc.validationIssues} max={2} />
                  </td>
                  <td className="px-4 py-3">
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
      )}
    </div>
  );
}
