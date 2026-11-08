import { Badge } from "./badge";
import type { PayStatus } from "@/domain/engine";

const MAP: Record<PayStatus, { label: string; tone: "neutral" | "ok" | "warn" | "bad" | "accent" }> = {
  draft: { label: "Draft", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  converted: { label: "Converted", tone: "accent" },
  open: { label: "Open", tone: "accent" },
  unpaid: { label: "Unpaid", tone: "warn" },
  partial: { label: "Partly paid", tone: "warn" },
  paid: { label: "Paid", tone: "ok" },
  overdue: { label: "Overdue", tone: "bad" },
};

export function StatusBadge({ status }: { status: PayStatus }) {
  const m = MAP[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
