"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
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
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="px-0">
          Risk policy and monitoring
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 pt-3">
        <p className="text-sm text-muted-foreground">
          Source {String(current.minSafetyBufferBpsSource ?? "NO_ADDITIONAL_BUFFER")} ·{" "}
          {String(current.minSafetyBufferBps ?? 0)} bps. Saving requires proved ownership.
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="allow-repay"
            checked={allowRepay}
            onCheckedChange={(value) => setAllowRepay(value === true)}
          />
          <Label htmlFor="allow-repay">Allow REPAY_DEBT</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="allow-add"
            checked={allowAdd}
            onCheckedChange={(value) => setAllowAdd(value === true)}
          />
          <Label htmlFor="allow-add">Allow ADD_COLLATERAL</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="monitor-wallet"
            checked={Boolean(monitoring.data?.monitoringEnabled)}
            disabled={!owns || saveMonitor.isPending}
            onCheckedChange={(value) => saveMonitor.mutate(value === true)}
          />
          <Label htmlFor="monitor-wallet">Monitor this wallet</Label>
        </div>
        {saveMonitor.error ? <ErrorState error={saveMonitor.error} title="Monitoring was not saved" /> : null}
        <div className="grid gap-2">
          <Label htmlFor="buffer-bps">Optional min safety buffer (bps)</Label>
          <Input
            id="buffer-bps"
            inputMode="numeric"
            value={buffer}
            onChange={(event) => setBuffer(event.target.value)}
            placeholder="leave empty"
            disabled={!owns}
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={!owns || save.isPending}>
          {save.isPending ? <Spinner /> : null}
          {owns ? "Save policy" : "Prove ownership to save"}
        </Button>
        {save.error ? <ErrorState error={save.error} title="Policy was not saved" /> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
