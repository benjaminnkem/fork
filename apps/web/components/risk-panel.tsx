import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import type { JsonRiskState } from "@/lib/api";
import { formatTokenRaw } from "@/lib/format";

export function RiskPanel({ risk }: { risk: JsonRiskState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Current risk
          <StatusBadge value={risk.status} kind="risk" />
        </CardTitle>
        <CardDescription>
          Comptroller <span className="font-mono">getAccountLiquidity</span> at Base block{" "}
          {risk.anchor.blockNumber}. Canonical solvency is this read, not a derived health factor.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/60 p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Liquidity</dt>
            <dd className="mt-1 font-mono text-lg">{formatTokenRaw(risk.liquidityRaw, 18)}</dd>
            <dd className="font-mono text-xs break-all text-muted-foreground">{risk.liquidityRaw}</dd>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Shortfall</dt>
            <dd className="mt-1 font-mono text-lg">{formatTokenRaw(risk.shortfallRaw, 18)}</dd>
            <dd className="font-mono text-xs break-all text-muted-foreground">{risk.shortfallRaw}</dd>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Safety buffer</dt>
            <dd className="mt-1 font-mono text-lg">
              {risk.derived?.safetyBufferBps === undefined
                ? "not derived"
                : `${risk.derived.safetyBufferBps} bps`}
            </dd>
          </div>
        </dl>
        <EvidenceList evidence={risk.evidence} />
      </CardContent>
    </Card>
  );
}
