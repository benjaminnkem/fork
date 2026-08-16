import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTokenRaw } from "@/lib/format";

interface StrategyPayload {
  repay?: string | { status?: string; amountRaw?: string | null; reasons?: string[] };
  addCollateral?: string | { status?: string; amountRaw?: string | null; reasons?: string[] };
}

function asEntry(
  value: StrategyPayload["repay"],
  fallbackName: string,
): { name: string; status: string; amountRaw?: string | null; reasons: string[] } {
  if (typeof value === "string") {
    return { name: fallbackName, status: value, reasons: [] };
  }
  if (value && typeof value === "object") {
    return {
      name: fallbackName,
      status: value.status ?? "UNKNOWN",
      amountRaw: value.amountRaw,
      reasons: value.reasons ?? [],
    };
  }
  return { name: fallbackName, status: "UNKNOWN", reasons: [] };
}

export function StrategiesPanel({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") {
    return (
      <EmptyState
        title="No strategy branches"
        description="This run did not persist strategy verification. Launch again with branch verification enabled, or inspect a run that already includes it."
      />
    );
  }
  const data = payload as StrategyPayload;
  const entries = [
    asEntry(data.repay, "REPAY_DEBT"),
    asEntry(data.addCollateral, "ADD_COLLATERAL"),
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map((entry) => (
        <Card key={entry.name}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {entry.name}
              <StatusBadge value={entry.status} kind="strategy" />
            </CardTitle>
            <CardDescription>
              {entry.amountRaw
                ? `Verified amount ${formatTokenRaw(entry.amountRaw, 6)} raw ${entry.amountRaw}`
                : "No verified amount"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {entry.reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional reasons on this event.</p>
            ) : (
              entry.reasons.map((reason) => (
                <Badge key={reason} variant="outline">
                  {reason}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
