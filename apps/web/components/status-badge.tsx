import { Badge } from "@/components/ui/badge";

const RISK: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SAFE: "default",
  AT_RISK: "secondary",
  SHORTFALL: "destructive",
  UNKNOWN: "outline",
};

const RUN: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  COMPLETED: "default",
  QUEUED: "secondary",
  RUNNING: "secondary",
  FAILED: "destructive",
  CANCELLED: "outline",
  STALE: "outline",
};

const STRATEGY: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  VERIFIED: "default",
  NOT_REQUIRED: "secondary",
  INFEASIBLE: "outline",
  REJECTED: "destructive",
  INCOMPLETE: "outline",
  PREPARED: "secondary",
  SUBMITTED: "secondary",
  PARTIAL: "secondary",
  MISMATCH: "destructive",
  FAILED: "destructive",
  EXPIRED: "outline",
};

export function StatusBadge({
  value,
  kind = "run",
}: {
  value: string;
  kind?: "risk" | "run" | "strategy" | "plain";
}) {
  const map = kind === "risk" ? RISK : kind === "strategy" ? STRATEGY : kind === "run" ? RUN : {};
  return <Badge variant={map[value] ?? "outline"}>{value}</Badge>;
}
