import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/types";

const config: Record<
  DocumentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "warning" | "success" }
> = {
  uploaded: { label: "Uploaded", variant: "secondary" },
  needs_review: { label: "Needs review", variant: "warning" },
  validated: { label: "Validated", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const c = config[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
