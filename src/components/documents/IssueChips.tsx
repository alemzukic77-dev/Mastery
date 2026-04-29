import { AlertCircle, AlertTriangle } from "lucide-react";
import { validationCodeLabel } from "@/lib/validation/labels";
import type { ValidationIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  issues: ValidationIssue[];
  max?: number;
}

export function IssueChips({ issues, max = 2 }: Props) {
  if (issues.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Sort: errors first, then warnings
  const sorted = [...issues].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "error" ? -1 : 1;
  });

  const visible = sorted.slice(0, max);
  const hidden = sorted.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((issue, idx) => {
        const label = validationCodeLabel[issue.code] ?? issue.code;
        const Icon = issue.severity === "error" ? AlertCircle : AlertTriangle;
        return (
          <span
            key={`${issue.code}-${idx}`}
            title={issue.message}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              issue.severity === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        );
      })}
      {hidden > 0 ? (
        <span
          title={sorted
            .slice(max)
            .map((i) => `${validationCodeLabel[i.code]}: ${i.message}`)
            .join("\n")}
          className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          +{hidden} more
        </span>
      ) : null}
    </div>
  );
}
