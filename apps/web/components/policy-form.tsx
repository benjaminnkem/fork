"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/error-state";
import {
  getAuthSession,
  getWalletMonitoring,
  getWalletPolicy,
  putWalletMonitoring,
  putWalletPolicy,
} from "@/lib/api";

export function PolicyForm({ address }: { address: string }) {
  const { address: connected } = useAccount();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["auth-session"], queryFn: getAuthSession, retry: false });
  const policy = useQuery({
    queryKey: ["policy", address],
    queryFn: () => getWalletPolicy(address),
  });
  const monitoring = useQuery({
    queryKey: ["monitoring-wallet", address],
    queryFn: () => getWalletMonitoring(address),
  });
  const owns =
    session.data?.address?.toLowerCase() === address.toLowerCase() &&
    connected?.toLowerCase() === address.toLowerCase();
  const current = policy.data?.policy ?? {};
  const [buffer, setBuffer] = useState("");
  const [allowRepay, setAllowRepay] = useState(true);
  const [allowAdd, setAllowAdd] = useState(true);
  const saveMonitor = useMutation({
    mutationFn: (enabled: boolean) => putWalletMonitoring(address, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["monitoring-wallet", address] });
    },
  });
  const save = useMutation({
    mutationFn: () =>
      putWalletPolicy(address, {
        ...(buffer.trim() ? { minSafetyBufferBps: Number(buffer) } : {}),
        allowRepayDebt: allowRepay,
        allowAddCollateral: allowAdd,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["policy", address] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk policy</CardTitle>
        <CardDescription>
          Read-only analysis does not require ownership. Saving a policy does. A buffer is only
          stored if you type one; Fork will not invent a default.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Active source: {String(current.minSafetyBufferBpsSource ?? "NO_ADDITIONAL_BUFFER")} · buffer{" "}
          {String(current.minSafetyBufferBps ?? 0)} bps
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowRepay} onChange={(event) => setAllowRepay(event.target.checked)} />
          Allow REPAY_DEBT
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowAdd} onChange={(event) => setAllowAdd(event.target.checked)} />
          Allow ADD_COLLATERAL
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(monitoring.data?.monitoringEnabled)}
            disabled={!owns || saveMonitor.isPending}
            onChange={(event) => saveMonitor.mutate(event.target.checked)}
          />
          Monitor this wallet for relevant Moonwell changes
        </label>
        {saveMonitor.error ? <ErrorState error={saveMonitor.error} title="Monitoring was not saved" /> : null}
        <div className="grid gap-2">
          <Label htmlFor="buffer-bps">Optional min safety buffer (bps)</Label>
          <Input
            id="buffer-bps"
            inputMode="numeric"
            value={buffer}
            onChange={(event) => setBuffer(event.target.value)}
            placeholder="leave empty for no additional buffer"
            disabled={!owns}
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={!owns || save.isPending}>
          {owns ? "Save policy" : "Prove ownership to save"}
        </Button>
        {save.error ? <ErrorState error={save.error} title="Policy was not saved" /> : null}
      </CardContent>
    </Card>
  );
}
