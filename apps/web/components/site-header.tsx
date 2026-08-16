"use client";

import Link from "next/link";
import { ConnectWallet } from "@/components/connect-wallet";
import { Badge } from "@/components/ui/badge";
import { useHealth, useMonitoring } from "@/hooks/use-api";

export function SiteHeader() {
  const health = useHealth();
  const monitoring = useMonitoring();
  const status = health.data?.status ?? (health.isError ? "down" : "checking");
  const lag = monitoring.data?.indexer?.ethereum?.lagBlocks;
  const reorg =
    monitoring.data?.indexer?.ethereum?.reorgDetected || monitoring.data?.indexer?.base?.reorgDetected;

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading text-lg tracking-tight">
            Fork
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-4">
            <Link href="/" className="hover:text-foreground">
              Analyze
            </Link>
            <Link href="/changes" className="hover:text-foreground">
              Changes
            </Link>
            <Link href="/historical" className="hover:text-foreground">
              Historical
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={status === "ok" ? "default" : status === "degraded" ? "secondary" : "outline"}>
            API {status}
          </Badge>
          {lag !== undefined ? (
            <Badge variant={reorg ? "destructive" : "outline"}>
              {reorg ? "reorg" : `index +${lag}`}
            </Badge>
          ) : null}
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
