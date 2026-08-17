"use client";

import Link from "next/link";
import { BeforeAfter } from "@/components/before-after";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoading } from "@/components/loading-state";
import { useProof, useSimulation } from "@/hooks/use-api";
import type { JsonEvidence } from "@/lib/api";
import { asString, formatTokenRaw, shortenHex } from "@/lib/format";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function ProofDetail({ id }: { id: string }) {
  const simulation = useSimulation(id);
  const ready = Boolean(simulation.data?.receiptHash);
  const proof = useProof(id, ready);

  if (simulation.isLoading || (ready && proof.isLoading)) {
    return <PageLoading label="Loading proof" />;
  }
  if (simulation.error) return <ErrorState error={simulation.error} title="Simulation missing" />;
  if (!ready) {
    return (
      <EmptyState
        title="Proof is not ready"
        description="The worker has not persisted a receipt hash for this run. Fork does not display a synthetic receipt."
      />
    );
  }
  if (proof.error) return <ErrorState error={proof.error} title="Receipt unavailable" />;
  if (!proof.data) return null;

  const receipt = proof.data;
  const body = asRecord(receipt.body);
  const material = asRecord(body.materialRisk ?? receipt.materialRisk);
  const evidence = Array.isArray(body.evidence)
    ? (body.evidence as JsonEvidence[])
    : Array.isArray(receipt.evidence)
      ? (receipt.evidence as JsonEvidence[])
      : [];
  const provenance = asRecord(body.provenance);
  const policy = asRecord(body.policy);

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-3xl tracking-tight">Proof receipt</h1>
        <p className="text-sm text-muted-foreground">
          Provenance is the receipt hash and contract evidence. The prose on this page is not a
          source of truth.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Receipt
            <StatusBadge value={asString(receipt.replayGrade) ?? "UNKNOWN"} kind="plain" />
          </CardTitle>
          <CardDescription className="font-mono break-all">
            {asString(receipt.receiptHash)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 font-mono text-sm">
          <div>schema {asString(receipt.receiptSchemaVersion)}</div>
          <div>engine {asString(receipt.engineVersion)}</div>
          <div>fork {asString(receipt.forkBlockNumber)} / {shortenHex(asString(receipt.forkBlockHash) ?? "", 10, 8)}</div>
          <div>
            wallet{" "}
            <Link className="underline-offset-4 hover:underline" href={`/wallets/${asString(receipt.wallet)}`}>
              {asString(receipt.wallet)}
            </Link>
          </div>
          <div>policy {asString(policy.policyVersion) ?? asString(receipt.policyVersion) ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Material risk</CardTitle>
          <CardDescription>Derived from Comptroller before/after liquidity, not a guessed health factor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <StatusBadge value={asString(material.classification) ?? "UNKNOWN"} kind="plain" />
          <dl className="grid gap-2 font-mono text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Liquidity drop bps</dt>
              <dd>{asString(material.liquidityDropBps) ?? "null"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Liquidity delta</dt>
              <dd>{asString(material.liquidityDeltaRaw) ? formatTokenRaw(String(material.liquidityDeltaRaw), 18) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Shortfall delta</dt>
              <dd>{asString(material.shortfallDeltaRaw) ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <BeforeAfter before={body.before ?? simulation.data?.before} after={body.after ?? simulation.data?.after} />

      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 font-mono text-xs">
          <div>comptroller {asString(provenance.comptroller)}</div>
          <div>temporal governor {asString(provenance.temporalGovernor)}</div>
          <div>market {asString(provenance.market)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceList evidence={evidence} />
        </CardContent>
      </Card>

      <Link className="text-sm underline-offset-4 hover:underline" href={`/simulations/${id}`}>
        Back to simulation
      </Link>
    </div>
  );
}
