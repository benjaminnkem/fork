"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "@/components/connect-wallet";
import { ForkMark } from "@/components/fork-mark";
import { Badge } from "@/components/ui/badge";
import { useHealth, useMonitoring } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Analyze" },
  { href: "/changes", label: "Changes" },
  { href: "/historical", label: "Historical" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const health = useHealth();
  const monitoring = useMonitoring();
  const status = health.data?.status ?? (health.isError ? "down" : "checking");
  const lag = monitoring.data?.indexer?.ethereum?.lagBlocks;
  const reorg =
    monitoring.data?.indexer?.ethereum?.reorgDetected || monitoring.data?.indexer?.base?.reorgDetected;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-foreground"
          >
            <ForkMark className="size-8 shrink-0 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)] transition-transform group-hover:scale-[1.04]" />
            <span className="font-heading text-lg font-semibold tracking-[-0.04em]">Fork</span>
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 transition-colors",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Badge variant={status === "ok" ? "default" : status === "degraded" ? "secondary" : "outline"}>
            API {status}
          </Badge>
          {lag !== undefined ? (
            <Badge variant={reorg ? "destructive" : "outline"}>
              {reorg ? "reorg" : `index +${lag}`}
            </Badge>
          ) : null}
          <div className="ml-auto sm:ml-0">
            <ConnectWallet />
          </div>
        </div>
      </div>
    </header>
  );
}
