"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  ExtractedData,
  LineItem,
  ProcessedDocument,
  ValidationIssue,
} from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  document: ProcessedDocument;
}

export function ReviewForm({ document }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<ExtractedData>(toFormState(document));
  const [busy, setBusy] = useState<"save" | "confirm" | "reject" | "delete" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(toFormState(document));
  }, [document]);

  async function callApi(body: object) {
    if (!user) throw new Error("Not authenticated");
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/documents/${document.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? `Request failed (${res.status})`);
    }
  }

  async function onSave() {
    setBusy("save");
    setError(null);
    try {
      await callApi({ data: form });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function onConfirm() {
    setBusy("confirm");
    setError(null);
    try {
      // First save current edits, then confirm
      await callApi({ data: form });
      await callApi({ action: "confirm" });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
      setBusy(null);
    }
  }

  async function onReject() {
    setBusy("reject");
    setError(null);
    try {
      await callApi({ action: "reject" });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!user) return;
    if (!confirm("Permanently delete this document? This cannot be undone.")) return;
    setBusy("delete");
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(null);
    }
  }

  function setField<K extends keyof ExtractedData>(key: K, value: ExtractedData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLineItem(index: number, patch: Partial<LineItem>) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addLineItem() {
    setForm((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: "", quantity: 0, unitPrice: 0, amount: 0 },
      ],
    }));
  }

  function removeLineItem(index: number) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  }

  const fieldErrors = buildFieldErrorMap(document.validationIssues);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Document type">
          <select
            value={form.type}
            onChange={(e) =>
              setField("type", e.target.value as ExtractedData["type"])
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="invoice">Invoice</option>
            <option value="purchase_order">Purchase order</option>
            <option value="unknown">Unknown</option>
          </select>
        </FormField>

        <FormField label="Currency" hint="ISO 4217 (USD, EUR, BAM…)">
          <Input
            value={form.currency ?? ""}
            onChange={(e) =>
              setField("currency", e.target.value || null)
            }
            placeholder="USD"
            maxLength={5}
          />
        </FormField>

        <FormField
          label="Supplier"
          error={fieldErrors.get("supplier")}
        >
          <Input
            value={form.supplier ?? ""}
            onChange={(e) => setField("supplier", e.target.value || null)}
          />
        </FormField>

        <FormField
          label="Document number"
          error={fieldErrors.get("documentNumber")}
        >
          <Input
            value={form.documentNumber ?? ""}
            onChange={(e) => setField("documentNumber", e.target.value || null)}
          />
        </FormField>

        <FormField
          label="Issue date"
          error={fieldErrors.get("issueDate")}
        >
          <Input
            type="date"
            value={form.issueDate ?? ""}
            onChange={(e) => setField("issueDate", e.target.value || null)}
          />
        </FormField>

        <FormField label="Due date" error={fieldErrors.get("dueDate")}>
          <Input
            type="date"
            value={form.dueDate ?? ""}
            onChange={(e) => setField("dueDate", e.target.value || null)}
          />
        </FormField>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Line items</h3>
          <Button type="button" size="sm" variant="outline" onClick={addLineItem}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>

        {form.lineItems.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            No line items.
          </p>
        ) : (
          <div className="space-y-2">
            {form.lineItems.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-start gap-2 rounded-md border bg-card p-3"
              >
                <div className="col-span-12 md:col-span-5">
                  <Label className="text-xs text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    rows={1}
                    value={item.description}
                    onChange={(e) =>
                      setLineItem(idx, { description: e.target.value })
                    }
                    className="mt-1 min-h-10"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={item.quantity}
                    onChange={(e) =>
                      setLineItem(idx, { quantity: Number(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    Unit price
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setLineItem(idx, { unitPrice: Number(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Amount</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={item.amount}
                    onChange={(e) =>
                      setLineItem(idx, { amount: Number(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="col-span-1 flex items-end justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeLineItem(idx)}
                    aria-label="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Subtotal">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            value={form.subtotal ?? ""}
            onChange={(e) =>
              setField(
                "subtotal",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </FormField>
        <FormField label="Tax">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            value={form.tax ?? ""}
            onChange={(e) =>
              setField("tax", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </FormField>
        <FormField label="Total" error={fieldErrors.get("total")}>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            value={form.total ?? ""}
            onChange={(e) =>
              setField(
                "total",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </FormField>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          disabled={busy !== null}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {busy === "delete" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onReject}
            disabled={busy !== null || document.status === "rejected"}
          >
            {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reject
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={busy !== null}
          >
            {busy === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy !== null || document.status === "validated"}
          >
            {busy === "confirm" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Confirm
          </Button>
        </div>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={error ? "text-destructive" : ""}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function toFormState(d: ProcessedDocument): ExtractedData {
  return {
    type: d.type,
    supplier: d.supplier,
    documentNumber: d.documentNumber,
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    currency: d.currency,
    lineItems: d.lineItems,
    subtotal: d.subtotal,
    tax: d.tax,
    total: d.total,
  };
}

function buildFieldErrorMap(
  issues: ValidationIssue[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const issue of issues) {
    if (issue.severity !== "error") continue;
    const key = issue.field.startsWith("lineItems")
      ? "lineItems"
      : issue.field;
    if (!map.has(key)) map.set(key, issue.message);
  }
  return map;
}
