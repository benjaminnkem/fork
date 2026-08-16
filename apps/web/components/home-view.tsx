"use client";

import Link from "next/link";
import { AddressForm } from "@/components/address-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomeView() {
  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h1 className="font-heading text-4xl tracking-tight">Fork</h1>
        <p className="max-w-2xl text-muted-foreground">
          Autonomous DeFi pre-execution risk agent. It applies a known protocol change to a pinned
          Base mainnet fork, reads Moonwell risk from the real contracts, and only surfaces rescue
          actions the EVM verifies.
        </p>
        <p className="font-mono text-sm text-primary">The model proposes. The EVM proves.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Read-only analysis</CardTitle>
          <CardDescription>
            No dashboard numbers are shown until the API returns a real wallet snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddressForm />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Indexed changes</CardTitle>
            <CardDescription>Source and destination status from the local governance store.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm underline-offset-4 hover:underline" href="/changes">
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
            <Link className="text-sm underline-offset-4 hover:underline" href="/historical">
              Open historical replays
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
