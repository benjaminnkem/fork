import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JsonIndexedChange, RelevantChangeMatch } from "@/lib/api";

function ChangeCard({
  change,
  sourceStatus,
  destinationStatus,
  exposure,
  wallet,
}: {
  change: RelevantChangeMatch["change"] | JsonIndexedChange["change"];
  sourceStatus: string;
  destinationStatus: string;
  exposure?: RelevantChangeMatch["exposure"];
  wallet?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>{change.type}</span>
          <StatusBadge value={change.status} kind="plain" />
        </CardTitle>
        <CardDescription className="font-mono">{change.id}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Source status</dt>
            <dd>{sourceStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Destination status</dt>
            <dd>{destinationStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Support</dt>
            <dd>{change.supportLevel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Proposal</dt>
            <dd className="font-mono">{change.proposalId ?? "—"}</dd>
          </div>
        </dl>
        {exposure ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">severity {exposure.severityHint}</Badge>
            {exposure.rationaleCodes.map((code) => (
              <Badge key={code} variant="outline">
                {code}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/changes/${encodeURIComponent(change.id)}`}>Details</Link>
          </Button>
          {wallet ? (
            <Button asChild size="sm">
              <Link
                href={`/wallets/${wallet}?simulate=${encodeURIComponent(change.id)}`}
              >
                Simulate impact
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function RelevantChangesList({
  matches,
  wallet,
}: {
  matches: RelevantChangeMatch[];
  wallet: string;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState
        title="No relevant supported changes"
        description="Indexed Moonwell changes are only listed here when this wallet supplies an affected market as collateral. Absence is a measured miss, not a placeholder."
      />
    );
  }
  return (
    <div className="grid gap-4">
      {matches.map((match) => (
        <ChangeCard
          key={match.change.id}
          change={match.change}
          sourceStatus={match.sourceStatus}
          destinationStatus={match.destinationStatus}
          exposure={match.exposure}
          wallet={wallet}
        />
      ))}
    </div>
  );
}

export function IndexedChangesList({ changes }: { changes: JsonIndexedChange[] }) {
  if (changes.length === 0) {
    return (
      <EmptyState
        title="No indexed changes"
        description="Run pnpm governance:sync so Ethereum governor proposals are written to the local store. This page does not invent events."
      />
    );
  }
  return (
    <div className="grid gap-4">
      {changes.map((record) => (
        <ChangeCard
          key={record.change.id}
          change={record.change}
          sourceStatus={record.sourceStatus}
          destinationStatus={record.destinationStatus}
        />
      ))}
    </div>
  );
}
