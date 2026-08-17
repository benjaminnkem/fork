"use client";

import { useSearchParams } from "next/navigation";
import { AddressForm } from "@/components/address-form";
import { ErrorState } from "@/components/error-state";
import { CardLoading, PageLoading } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PositionsTable } from "@/components/positions-table";
import { RelevantChangesList } from "@/components/changes-list";
import { RiskPanel } from "@/components/risk-panel";
import { PolicyForm } from "@/components/policy-form";
import { SimulateForm } from "@/components/simulate-form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { usePositions, useRelevantChanges, useRisk } from "@/hooks/use-api";
import { explorerAddress, formatTimeAgo, formatTimestamp } from "@/lib/format";
import { DEMO_WALLET, SHORTFALL_DEMO_WALLET } from "@/lib/demo";

export function WalletAnalysis({ address }: { address: string }) {
  const search = useSearchParams();
  const simulate = search.get("simulate") ?? undefined;
  const positions = usePositions(address);
  const risk = useRisk(address);
  const relevant = useRelevantChanges(address);
  const explorer = explorerAddress(8453, address);
  const isShortfallDemo = address.toLowerCase() === SHORTFALL_DEMO_WALLET.toLowerCase();
  const isDemo = isShortfallDemo || address.toLowerCase() === DEMO_WALLET.toLowerCase();
  const loading = positions.isLoading || risk.isLoading;

  if (loading && !positions.data && !risk.data) {
    return <PageLoading label="Reading Moonwell positions" />;
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={isShortfallDemo ? "Shortfall demo" : isDemo ? "Solvent demo" : "Live wallet"}
        title="Wallet analysis"
        description={
          <div className="grid gap-1">
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
              <p className="font-mono text-xs break-all">{address}</p>
            )}
            {risk.data ? (
              <p>
                Snapshot {formatTimestamp(risk.data.risk.anchor.timestamp)} (
                {formatTimeAgo(risk.data.risk.anchor.timestamp)})
              </p>
            ) : null}
          </div>
        }
      />

      {positions.error ? <ErrorState error={positions.error} title="Positions unavailable" /> : null}
      {risk.error ? <ErrorState error={risk.error} title="Risk unavailable" /> : null}
      {risk.data ? <RiskPanel risk={risk.data.risk} /> : null}
      {positions.data ? <PositionsTable positions={positions.data.positions} /> : null}

      <SimulateForm wallet={address} changeId={simulate} />

      <section className="grid gap-3">
        <h2 className="font-heading text-lg tracking-tight">Relevant changes</h2>
        {relevant.isLoading ? <CardLoading label="Matching indexed changes" /> : null}
        {relevant.error ? <ErrorState error={relevant.error} title="Changes unavailable" /> : null}
        {relevant.data ? (
          <RelevantChangesList matches={relevant.data.matches} wallet={address} />
        ) : null}
      </section>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="px-0">
            Analyze a different address
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <AddressForm initial={address} compact showDemo />
        </CollapsibleContent>
      </Collapsible>

      <PolicyForm address={address} />
    </div>
  );
}
