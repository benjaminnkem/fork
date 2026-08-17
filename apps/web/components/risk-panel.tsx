import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import type { JsonRiskState } from "@/lib/api";
import { explorerBlock, formatTimeAgo, formatTimestamp, formatTokenRaw } from "@/lib/format";

export function RiskPanel({ risk }: { risk: JsonRiskState }) {
  const blockHref = explorerBlock(risk.anchor.chainId, risk.anchor.blockNumber);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Current risk
          <StatusBadge value={risk.status} kind="risk" />
        </CardTitle>
        <CardDescription>
          Comptroller liquidity at{" "}
          {blockHref ? (
            <a href={blockHref} className="underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
              block {risk.anchor.blockNumber}
            </a>
          ) : (
            <>block {risk.anchor.blockNumber}</>
          )}
          {" · "}
          <span title={formatTimestamp(risk.anchor.timestamp)}>{formatTimeAgo(risk.anchor.timestamp)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/60 p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Liquidity</dt>
            <dd className="mt-1 font-mono text-lg">{formatTokenRaw(risk.liquidityRaw, 18)}</dd>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Shortfall</dt>
            <dd className="mt-1 font-mono text-lg">{formatTokenRaw(risk.shortfallRaw, 18)}</dd>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Buffer</dt>
            <dd className="mt-1 font-mono text-lg">
              {risk.derived?.safetyBufferBps === undefined ? "—" : `${risk.derived.safetyBufferBps} bps`}
            </dd>
          </div>
        </dl>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="px-0">
              Evidence
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <EvidenceList evidence={risk.evidence} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
