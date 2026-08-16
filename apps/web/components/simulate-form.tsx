"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/error-state";
import { createImpact } from "@/lib/api";

export function SimulateForm({
  wallet,
  changeId,
}: {
  wallet: string;
  changeId?: string;
}) {
  const router = useRouter();
  const [includeStrategies, setIncludeStrategies] = useState(true);
  const mutation = useMutation({
    mutationFn: () =>
      createImpact({
        wallet,
        changeId,
        includeStrategies,
      }),
    onSuccess: (run) => {
      router.push(`/simulations/${run.id}`);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulate impact</CardTitle>
        <CardDescription>
          Queues a DESTINATION_EFFECT_REPLAY of the pinned Moonwell change on a real Anvil fork.
          Results come from the worker, not from this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {changeId ? (
          <p className="font-mono text-xs text-muted-foreground">{changeId}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No change selected. The API will use the pinned moonwell-176 scenario.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeStrategies}
            onChange={(event) => setIncludeStrategies(event.target.checked)}
          />
          Verify REPAY_DEBT and ADD_COLLATERAL branches
        </label>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Queuing…" : "Launch simulation"}
        </Button>
        {mutation.error ? <ErrorState error={mutation.error} title="Simulation was not queued" /> : null}
      </CardContent>
    </Card>
  );
}
