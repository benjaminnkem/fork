"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
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
    <Card className="ring-primary/15">
      <CardHeader>
        <CardTitle>Simulate proposal 176</CardTitle>
        <CardDescription>
          Replays the mwrsETH collateral-factor change on a real Anvil fork. Live risk above is
          current head, not the 176 result.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {changeId ? <p className="font-mono text-xs text-muted-foreground">{changeId}</p> : null}
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-strategies"
            checked={includeStrategies}
            onCheckedChange={(value) => setIncludeStrategies(value === true)}
          />
          <Label htmlFor="include-strategies">Also search repay / add-collateral</Label>
        </div>
        <Button size="lg" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Spinner />
              Queuing…
            </>
          ) : (
            "Launch simulation"
          )}
        </Button>
        {mutation.error ? <ErrorState error={mutation.error} title="Simulation was not queued" /> : null}
      </CardContent>
    </Card>
  );
}
