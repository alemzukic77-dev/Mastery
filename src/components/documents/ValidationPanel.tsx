import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ValidationIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="font-medium text-success">All checks passed</p>
          <p className="text-sm text-muted-foreground">
            No issues detected. You can confirm this document.
          </p>
        </div>
      </div>
    );
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Validation issues</h3>
        <span className="text-sm text-muted-foreground">
          {errors.length} error{errors.length === 1 ? "" : "s"} ·{" "}
          {warnings.length} warning{warnings.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="space-y-2">
        {issues.map((issue, idx) => (
          <li
            key={`${issue.code}-${issue.field}-${idx}`}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
              issue.severity === "error"
                ? "border-destructive/30 bg-destructive/5"
                : "border-warning/30 bg-warning/5",
            )}
          >
            {issue.severity === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            )}
            <div className="min-w-0">
              <p className="font-medium">{issue.message}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {issue.field} · {issue.code}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
