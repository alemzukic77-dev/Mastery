import { AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AggregateStats } from "@/hooks/useStats";
import { formatCurrency } from "@/lib/utils";

export function StatsCards({ stats }: { stats: AggregateStats }) {
  const totalsByCurrency = Object.entries(stats.validatedTotalsByCurrency)
    .map(([currency, v]) => ({ currency, ...v }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        icon={<FileText className="h-4 w-4" />}
        label="Total documents"
        value={String(stats.totalCount)}
      />
      <Stat
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        label="Validated"
        value={String(stats.byStatus.validated ?? 0)}
      />
      <Stat
        icon={<Clock className="h-4 w-4 text-warning" />}
        label="Needs review"
        value={String(stats.byStatus.needs_review ?? 0)}
      />
      <Stat
        icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
        label="Open issues"
        value={String(stats.openIssuesCount)}
      />

      {totalsByCurrency.length > 0 ? (
        <Card className="col-span-1 sm:col-span-2 lg:col-span-4">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Validated totals by currency
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 sm:gap-x-8">
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
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
