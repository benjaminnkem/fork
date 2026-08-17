"use client";

import Link from "next/link";
import { AddressForm } from "@/components/address-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Read the live position",
    body: "Comptroller snapshots and account liquidity on Base. No estimated USD scores.",
  },
  {
    title: "Replay the known change",
    body: "Apply the pinned destination effect on an Anvil fork of a real historical block.",
  },
  {
    title: "Accept only what the EVM proves",
    body: "Rescue amounts are searched on reset snapshots. Missing inventory is infeasible, not invented.",
  },
];

export function HomeView() {
  return (
    <div className="grid gap-10">
      <PageHeader
        eyebrow="Pre-execution risk · Base 8453"
        title="Know the next protocol change before it hits the wallet."
        description="Fork applies a known Moonwell change to a pinned Base mainnet fork, reads risk from the real contracts, and only surfaces rescue actions the EVM verifies."
      />
      <p className="font-mono text-sm text-primary">The model proposes. The EVM proves.</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
        <Card className="ring-primary/15">
          <CardHeader>
            <CardTitle>Analyze a Base address</CardTitle>
            <CardDescription>
              No dashboard numbers are shown until the API returns a real wallet snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddressForm />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {STEPS.map((step, index) => (
            <Card key={step.title} size="sm">
              <CardHeader>
                <CardDescription>0{index + 1}</CardDescription>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Indexed changes</CardTitle>
            <CardDescription>
              Source and destination status from the local governance store. Empty until a real sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/changes">
              Browse changes
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Historical replay</CardTitle>
            <CardDescription>Only the pinned real Moonwell-176 scenario is listed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/historical">
              Open historical replays
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
