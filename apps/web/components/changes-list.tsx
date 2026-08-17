"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { createImpact, type JsonIndexedChange, type RelevantChangeMatch } from "@/lib/api";

const REPLAYABLE_CHANGE_ID = "moonwell:eth:176";

function canReplay(change: { id: string; proposalId?: string }) {
  return change.id === REPLAYABLE_CHANGE_ID || change.proposalId === "176";
}

function SimulateChangeButton({
  wallet,
  changeId,
}: {
  wallet: string;
  changeId: string;
}) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () =>
      createImpact({
        wallet,
        changeId,
        scenario: "moonwell-176",
        includeStrategies: true,
      }),
    onSuccess: (run) => {
      router.push(`/simulations/${run.id}`);
    },
  });

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <>
            <Spinner />
            Queuing…
          </>
        ) : (
          "Simulate"
        )}
      </Button>
      {mutation.error ? <ErrorState error={mutation.error} title="Simulation was not queued" /> : null}
    </div>
  );
}

function ChangeCard({
  change,
  sourceStatus,
  destinationStatus,
  wallet,
}: {
  change: RelevantChangeMatch["change"] | JsonIndexedChange["change"];
  sourceStatus: string;
  destinationStatus: string;
  wallet?: string;
}) {
  const replayable = Boolean(wallet) && canReplay(change);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>Proposal {change.proposalId ?? change.id}</span>
          <StatusBadge value={change.status} kind="plain" />
        </CardTitle>
        <CardDescription>
          {change.type.replaceAll("_", " ").toLowerCase()} · source {sourceStatus.toLowerCase()} ·
          dest {destinationStatus.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/changes/${encodeURIComponent(change.id)}`}>Details</Link>
        </Button>
        {replayable ? <SimulateChangeButton wallet={wallet!} changeId={change.id} /> : null}
        {wallet && !replayable ? (
          <p className="self-center text-xs text-muted-foreground">
            Only proposal 176 has a destination-effect replay
          </p>
        ) : null}
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
        description="Listed only when this wallet supplies an affected market as collateral, and the governance store has been synced."
      />
    );
  }
  return (
    <div className="grid gap-3">
      {matches.map((match) => (
        <ChangeCard
          key={match.change.id}
          change={match.change}
          sourceStatus={match.sourceStatus}
          destinationStatus={match.destinationStatus}
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
        description="Run pnpm governance:sync so Ethereum governor proposals are written to the local store."
      />
    );
  }
  return (
    <div className="grid gap-3">
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
