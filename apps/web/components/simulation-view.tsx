"use client";

import Link from "next/link";
import { AgentTrace } from "@/components/agent-trace";
import { BeforeAfter } from "@/components/before-after";
import { ErrorState } from "@/components/error-state";
import { SimulationTimeline } from "@/components/simulation-timeline";
import { StatusBadge } from "@/components/status-badge";
import { StrategiesPanel } from "@/components/strategies-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useProof, useSimulation, useStrategies } from "@/hooks/use-api";
import { useSimulationStream } from "@/hooks/use-simulation-stream";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/loading-state";
import { asString, shortenHex } from "@/lib/format";

function agentRunIdFrom(run: { events: Array<{ data?: Record<string, unknown> }> }): string | undefined {
  for (const event of run.events) {
    const value = asString(event.data?.agentRunId) ?? asString(event.data?.runId);
    if (value) return value;
  }
  return undefined;
}

export function SimulationView({ id }: { id: string }) {
  const simulation = useSimulation(id);
  useSimulationStream(id);
  const run = simulation.data;
  const finished = run?.status === "COMPLETED" || run?.status === "FAILED";
  const proofReady = Boolean(run?.receiptHash);
  const proof = useProof(id, proofReady);
  const strategies = useStrategies(id, Boolean(run?.includeStrategies) || finished);

  const running = run?.status === "QUEUED" || run?.status === "RUNNING";

  if (simulation.isLoading) return <PageLoading label="Loading simulation" />;
  if (simulation.error) return <ErrorState error={simulation.error} title="Simulation not found" />;
  if (!run) return null;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Impact run"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Simulation
            <StatusBadge value={run.status} kind="run" />
          </span>
        }
        description={<span className="font-mono text-xs">{run.id}</span>}
      />
      <dl className="grid gap-3 rounded-xl border border-border bg-card/60 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Wallet</dt>
            <dd>
              <Link className="font-mono underline-offset-4 hover:underline" href={`/wallets/${run.wallet}`}>
                {run.wallet}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Replay grade</dt>
            <dd className="font-mono">{run.replayGrade}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fork block</dt>
            <dd className="font-mono">{run.forkBlockNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fork hash</dt>
            <dd className="font-mono">{shortenHex(run.forkBlockHash, 10, 8)}</dd>
          </div>
        </dl>
      {run.errorCode ? <ErrorState error={{ message: run.errorCode }} title="Run failed" /> : null}
      {run.status === "CANCELLED" ? (
        <ErrorState error={{ message: "This simulation was cancelled." }} title="Cancelled" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Live progress</CardTitle>
          <CardDescription>
            SSE events plus REST rehydrate. Reconnects use persisted events, not in-memory guesses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SimulationTimeline events={run.events} running={running} />
        </CardContent>
      </Card>

      <BeforeAfter before={run.before} after={run.after} />

      <section className="grid gap-3">
        <h2 className="text-xl">Verified strategies</h2>
        {strategies.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading strategies
          </div>
        ) : null}
        {strategies.error ? <ErrorState error={strategies.error} title="Strategies unavailable" /> : null}
        {strategies.data ? <StrategiesPanel payload={strategies.data.strategies} /> : null}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl">Agent trace</h2>
        <AgentTrace runId={agentRunIdFrom(run)} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild disabled={!proofReady}>
          <Link href={`/simulations/${run.id}/proof`}>Open proof</Link>
        </Button>
        <Button asChild variant="outline" disabled={!proofReady}>
          <Link href={`/simulations/${run.id}/execute`}>Review execution</Link>
        </Button>
        {proof.error ? <ErrorState error={proof.error} title="Proof not ready" /> : null}
      </div>
    </div>
  );
}
