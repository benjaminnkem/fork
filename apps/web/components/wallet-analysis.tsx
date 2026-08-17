"use client";

import { useSearchParams } from "next/navigation";
import { AddressForm } from "@/components/address-form";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { PositionsTable } from "@/components/positions-table";
import { RelevantChangesList } from "@/components/changes-list";
import { RiskPanel } from "@/components/risk-panel";
import { PolicyForm } from "@/components/policy-form";
import { SimulateForm } from "@/components/simulate-form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePositions, useRelevantChanges, useRisk } from "@/hooks/use-api";
import { explorerAddress } from "@/lib/format";
import { DEMO_WALLET, SHORTFALL_DEMO_WALLET } from "@/lib/demo";

export function WalletAnalysis({ address }: { address: string }) {
  const search = useSearchParams();
  const simulate = search.get("simulate") ?? undefined;
  const positions = usePositions(address);
  const risk = useRisk(address);
  const relevant = useRelevantChanges(address);
  const explorer = explorerAddress(8453, address);
  const isShortfallDemo = address.toLowerCase() === SHORTFALL_DEMO_WALLET.toLowerCase();
  const isDemo =
    isShortfallDemo || address.toLowerCase() === DEMO_WALLET.toLowerCase();

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={isShortfallDemo ? "Shortfall demo" : isDemo ? "Solvent demo" : "Live wallet"}
        title="Wallet analysis"
        description={
          <div className="grid gap-2">
            <p>
              Read-only Moonwell Core data on Base 8453. Connecting a wallet does not authenticate this
              page.
            </p>
            {explorer ? (
              <a
                className="font-mono text-xs break-all text-primary underline-offset-4 hover:underline sm:text-sm"
                href={explorer}
                target="_blank"
                rel="noreferrer"
              >
                {address}
              </a>
            ) : (
              <p className="font-mono text-xs break-all text-foreground">{address}</p>
            )}
          </div>
        }
      />

      <details className="rounded-xl border border-border bg-card/60 p-4">
        <summary className="cursor-pointer text-sm font-medium">Analyze a different address</summary>
        <div className="mt-4">
          <AddressForm initial={address} compact showDemo />
        </div>
      </details>

      {positions.isLoading ? <Skeleton className="h-40" /> : null}
      {positions.error ? <ErrorState error={positions.error} title="Positions unavailable" /> : null}
      {positions.data ? <PositionsTable positions={positions.data.positions} /> : null}

      {risk.isLoading ? <Skeleton className="h-40" /> : null}
      {risk.error ? <ErrorState error={risk.error} title="Risk unavailable" /> : null}
      {risk.data ? <RiskPanel risk={risk.data.risk} /> : null}

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="font-heading text-xl tracking-tight">Relevant governance changes</h2>
          <p className="text-sm text-muted-foreground">
            Listed only when this wallet supplies an affected market as collateral.
          </p>
        </div>
        {relevant.isLoading ? <Skeleton className="h-32" /> : null}
        {relevant.error ? <ErrorState error={relevant.error} title="Changes unavailable" /> : null}
        {relevant.data ? (
          <RelevantChangesList matches={relevant.data.matches} wallet={address} />
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <PolicyForm address={address} />
        <SimulateForm wallet={address} changeId={simulate} />
      </div>
    </div>
  );
}
