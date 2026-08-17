"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { CardLoading } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useHistoricalReplays } from "@/hooks/use-api";
import { normalizeAddress, runHistoricalReplay } from "@/lib/api";
import { DEMO_WALLET, SHORTFALL_DEMO_WALLET } from "@/lib/demo";
import { shortenHex } from "@/lib/format";

export function HistoricalView() {
  const replays = useHistoricalReplays();
  const router = useRouter();
  const [wallet, setWallet] = useState("");
  const [includeStrategies, setIncludeStrategies] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (slug: string) => {
      const trimmed = wallet.trim();
      const normalized = trimmed ? normalizeAddress(trimmed) : undefined;
      if (trimmed && !normalized) {
        throw new Error("Optional wallet override must be a valid address");
      }
      return runHistoricalReplay(slug, {
        wallet: normalized ?? undefined,
        includeStrategies,
      });
    },
    onSuccess: (run) => router.push(`/simulations/${run.id}`),
  });

  if (replays.isLoading) return <CardLoading label="Loading pinned replays" />;
  if (replays.error) return <ErrorState error={replays.error} title="Historical catalog unavailable" />;
  if (!replays.data || replays.data.length === 0) {
    return (
      <EmptyState
        title="No pinned historical replays"
        description="Fork only lists real, documented scenarios."
      />
    );
  }

  return (
    <div className="grid gap-6">
      {replays.data.map((replay) => (
        <Card key={replay.slug}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {replay.slug}
              <Badge variant="outline">{replay.replayGrade}</Badge>
            </CardTitle>
            <CardDescription>
              Proposal {replay.proposalId} · Base block {replay.forkBlockNumber} ·{" "}
              {shortenHex(replay.forkBlockHash, 10, 8)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`wallet-${replay.slug}`}>Wallet override (optional)</Label>
              <Input
                id={`wallet-${replay.slug}`}
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="defaults to the pinned replay wallet"
                className="font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setWallet(SHORTFALL_DEMO_WALLET)}>
                  Prefill shortfall demo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setWallet(DEMO_WALLET)}>
                  Prefill solvent demo
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`strategies-${replay.slug}`}
                checked={includeStrategies}
                onCheckedChange={(value) => setIncludeStrategies(value === true)}
              />
              <Label htmlFor={`strategies-${replay.slug}`}>Search rescue branches</Label>
            </div>
            <Button
              onClick={() => {
                setFormError(null);
                const trimmed = wallet.trim();
                if (trimmed && !normalizeAddress(trimmed)) {
                  setFormError("Optional wallet override must be a valid address");
                  return;
                }
                mutation.mutate(replay.slug);
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Spinner />
                  Queuing…
                </>
              ) : (
                "Run pinned replay"
              )}
            </Button>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {mutation.error ? <ErrorState error={mutation.error} title="Replay was not queued" /> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
