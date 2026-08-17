"use client";

import { AddressForm } from "@/components/address-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomeView() {
  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <PageHeader
        eyebrow="Base 8453 · Moonwell Core"
        title="Know the next protocol change before it hits the wallet."
        description="Paste a Base address or use a demo wallet. Numbers appear only after the API reads the Comptroller."
      />
      <p className="font-mono text-sm text-primary">The model proposes. The EVM proves.</p>
      <Card>
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
    </div>
  );
}
