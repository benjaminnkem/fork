"use client";

import { AddressForm } from "@/components/address-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    n: "01",
    title: "Snapshot",
    body: "Read the wallet from the live Moonwell Comptroller on Base.",
  },
  {
    n: "02",
    title: "Replay",
    body: "Apply the supported destination effect on an Anvil mainnet fork.",
  },
  {
    n: "03",
    title: "Decide",
    body: "Post-state invariants mark SAFE, AT_RISK, or SHORTFALL.",
  },
] as const;

const CAPABILITIES = [
  {
    title: "Comptroller-backed numbers",
    body: "Positions and risk come from Base 8453 after the API returns a real snapshot. Nothing is invented in the UI.",
  },
  {
    title: "Destination-effect replay",
    body: "Proposal 176 is the supported Moonwell Core replay. The model can propose a plan. Only the EVM proves it.",
  },
  {
    title: "User-signed execution",
    body: "Rescue plans stay unsigned until the connected wallet approves. Fork never holds keys.",
  },
] as const;

export function HomeView() {
  return (
    <div className="grid gap-10 lg:gap-14">
      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:gap-x-14 lg:gap-y-8">
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Base 8453</Badge>
            <Badge variant="outline">Moonwell Core</Badge>
            <p className="font-mono text-xs text-primary sm:text-sm">The model proposes. The EVM proves.</p>
          </div>
          <div className="grid gap-4">
            <h1 className="font-heading max-w-xl text-4xl leading-[1.05] tracking-tight text-pretty sm:text-5xl">
              Know the next protocol change before it hits the wallet.
            </h1>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Paste a Base address or use a demo wallet. Numbers appear only after the API reads the
              Comptroller. Fork then replays a supported change on a mainnet fork so solvency is decided
              by contracts, not the model.
            </p>
          </div>
        </div>
        <Card className="bg-card/90 shadow-[0_24px_80px_-48px_color-mix(in_oklab,var(--primary)_55%,transparent)] lg:row-span-2">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Analyze a Base address</CardTitle>
            <CardDescription>
              No dashboard numbers are shown until the API returns a real wallet snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <AddressForm />
          </CardContent>
        </Card>
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="grid gap-1.5 rounded-lg bg-card/70 px-3 py-3 ring-1 ring-foreground/10"
            >
              <span className="font-mono text-[0.65rem] tracking-[0.16em] text-primary">{step.n}</span>
              <span className="font-heading text-sm">{step.title}</span>
              <span className="text-xs leading-5 text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {CAPABILITIES.map((item) => (
          <article
            key={item.title}
            className="grid gap-2 rounded-lg bg-card/50 px-4 py-4 ring-1 ring-foreground/10"
          >
            <h2 className="font-heading text-sm tracking-tight">{item.title}</h2>
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
