"use client";

import { useSearchParams } from "next/navigation";
import { AddressForm } from "@/components/address-form";
import { ErrorState } from "@/components/error-state";
import { PositionsTable } from "@/components/positions-table";
import { RelevantChangesList } from "@/components/changes-list";
import { RiskPanel } from "@/components/risk-panel";
import { PolicyForm } from "@/components/policy-form";
import { SimulateForm } from "@/components/simulate-form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePositions, useRelevantChanges, useRisk } from "@/hooks/use-api";
import { shortenHex } from "@/lib/format";

export function WalletAnalysis({ address }: { address: string }) {
  const search = useSearchParams();
  const simulate = search.get("simulate") ?? undefined;
  const positions = usePositions(address);
  const risk = useRisk(address);
  const relevant = useRelevantChanges(address);

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-3xl tracking-tight">Wallet analysis</h1>
        <p className="font-mono text-sm text-muted-foreground">{address}</p>
        <p className="text-sm text-muted-foreground">
          Read-only Moonwell Core data on Base 8453 for {shortenHex(address)}. Connecting a wallet
          does not authenticate this page.
        </p>
        <AddressForm initial={address} />
      </section>

      {positions.isLoading ? <Skeleton className="h-40" /> : null}
      {positions.error ? <ErrorState error={positions.error} title="Positions unavailable" /> : null}
      {positions.data ? <PositionsTable positions={positions.data.positions} /> : null}

      {risk.isLoading ? <Skeleton className="h-40" /> : null}
      {risk.error ? <ErrorState error={risk.error} title="Risk unavailable" /> : null}
      {risk.data ? <RiskPanel risk={risk.data.risk} /> : null}

      <section className="grid gap-3">
        <h2 className="text-xl">Relevant governance changes</h2>
        {relevant.isLoading ? <Skeleton className="h-32" /> : null}
        {relevant.error ? <ErrorState error={relevant.error} title="Changes unavailable" /> : null}
        {relevant.data ? (
          <RelevantChangesList matches={relevant.data.matches} wallet={address} />
        ) : null}
      </section>

      <PolicyForm address={address} />
      <SimulateForm wallet={address} changeId={simulate} />
    </div>
  );
}
