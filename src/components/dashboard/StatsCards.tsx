import { AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProcessedDocument } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function StatsCards({ documents }: { documents: ProcessedDocument[] }) {
  const total = documents.length;
  const validated = documents.filter((d) => d.status === "validated").length;
  const needsReview = documents.filter((d) => d.status === "needs_review").length;
  const totalIssues = documents.reduce(
    (acc, d) => acc + d.validationIssues.length,
    0,
  );

  const totalsByCurrency = computeTotalsByCurrency(documents);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        icon={<FileText className="h-4 w-4" />}
        label="Total documents"
        value={String(total)}
      />
      <Stat
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        label="Validated"
        value={String(validated)}
      />
      <Stat
        icon={<Clock className="h-4 w-4 text-warning" />}
        label="Needs review"
        value={String(needsReview)}
      />
      <Stat
        icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
        label="Open issues"
        value={String(totalIssues)}
      />

      {totalsByCurrency.length > 0 ? (
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Validated totals by currency
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {totalsByCurrency.map((row) => (
                <div key={row.currency} className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {formatCurrency(row.amount, row.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.count} doc{row.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function computeTotalsByCurrency(documents: ProcessedDocument[]) {
  const map = new Map<string, { amount: number; count: number }>();
  for (const d of documents) {
    if (d.status !== "validated" || d.total === null || !d.currency) continue;
    const existing = map.get(d.currency) ?? { amount: 0, count: 0 };
    existing.amount += d.total;
    existing.count += 1;
    map.set(d.currency, existing);
  }
  return Array.from(map.entries())
    .map(([currency, v]) => ({ currency, ...v }))
    .sort((a, b) => b.amount - a.amount);
}
