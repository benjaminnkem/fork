import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { JsonRiskState } from "@/lib/api";
import { formatTokenRaw } from "@/lib/format";

interface Snapshot {
  collateralFactorMantissa?: string;
  risk?: JsonRiskState;
}

function readSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object") return {};
  return value as Snapshot;
}

export function BeforeAfter({ before, after }: { before: unknown; after: unknown }) {
  const left = readSnapshot(before);
  const right = readSnapshot(after);
  if (!left.risk && !right.risk) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Before / after</CardTitle>
          <CardDescription>Risk snapshots are not on this run yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SnapshotCard title="Before" snapshot={left} />
      <SnapshotCard title="After" snapshot={right} />
    </div>
  );
}

function SnapshotCard({ title, snapshot }: { title: string; snapshot: Snapshot }) {
  const risk = snapshot.risk;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {risk ? <StatusBadge value={risk.status} kind="risk" /> : null}
        </CardTitle>
        <CardDescription>
          Collateral factor mantissa {snapshot.collateralFactorMantissa ?? "not reported"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {risk ? (
          <dl className="grid gap-2 font-mono text-sm">
            <div>
              <dt className="text-muted-foreground">Liquidity</dt>
              <dd>{formatTokenRaw(risk.liquidityRaw, 18)}</dd>
              <dd className="text-xs text-muted-foreground">{risk.liquidityRaw}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Shortfall</dt>
              <dd>{formatTokenRaw(risk.shortfallRaw, 18)}</dd>
              <dd className="text-xs text-muted-foreground">{risk.shortfallRaw}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Snapshot missing.</p>
        )}
      </CardContent>
    </Card>
  );
}
