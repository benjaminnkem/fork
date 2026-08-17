"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ProveOwnership } from "@/components/prove-ownership";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession, getExecution, prepareExecution, registerExecutionTx } from "@/lib/api";
import { expectedBaseChainId } from "@/lib/wagmi";
import { explorerTx, formatTokenRaw, shortenHex } from "@/lib/format";

export function ExecutionReview({
  simulationId,
  wallet,
}: {
  simulationId: string;
  wallet: string;
}) {
  const { address, chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const session = useQuery({ queryKey: ["auth-session"], queryFn: getAuthSession, retry: false });
  const [planId, setPlanId] = useState<string | undefined>();
  const [strategyType, setStrategyType] = useState<"REPAY_DEBT" | "ADD_COLLATERAL">("ADD_COLLATERAL");
  const owns =
    isConnected &&
    address?.toLowerCase() === wallet.toLowerCase() &&
    session.data?.address?.toLowerCase() === wallet.toLowerCase();
  const wrongNetwork = Boolean(address) && chainId !== expectedBaseChainId;
  const prepared = useQuery({
    queryKey: ["execution", planId],
    queryFn: () => getExecution(planId!),
    enabled: Boolean(planId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "SUBMITTED" || status === "PREPARED" ? 4000 : false;
    },
  });
  const prepare = useMutation({
    mutationFn: () => prepareExecution({ wallet, simulationId, strategyType }),
    onSuccess: (plan) => setPlanId(plan.id),
  });
  const send = useMutation({
    mutationFn: async (callIndex: number) => {
      const plan = prepared.data;
      if (!plan) throw new Error("Prepare a plan first");
      const call = plan.decodedCalls[callIndex];
      if (!call) throw new Error("Missing call");
      const hash = await sendTransactionAsync({
        chainId: expectedBaseChainId,
        to: call.to as `0x${string}`,
        data: call.data as `0x${string}`,
        value: 0n,
      });
      return registerExecutionTx(plan.id, { txHash: hash, callIndex });
    },
  });

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-3xl tracking-tight">Execution review</h1>
        <p className="text-sm text-muted-foreground">
          Fork never holds a key and never submits for you. The server only returns allowlisted
          REPAY_DEBT / ADD_COLLATERAL calls after a fresh proof and a live-head dry-run.
        </p>
        <ProveOwnership />
      </section>

      {!owns ? (
        <EmptyState
          title="Prove ownership of this wallet"
          description="Connect the simulation wallet on Base 8453 and sign the auth message. Inspecting a public address is not the same as owning it."
        />
      ) : null}

      {wrongNetwork ? (
        <Button variant="destructive" onClick={() => switchChain({ chainId: expectedBaseChainId })}>
          Switch to Base Mainnet
        </Button>
      ) : null}
      {isConnected && address && address.toLowerCase() !== wallet.toLowerCase() ? (
        <EmptyState
          title="Connected wallet changed"
          description="The connected account is not the simulation wallet. Switch back before signing. Fork will not send from a different address."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Prepare a live plan</CardTitle>
          <CardDescription>
            This rebuilds the plan from current Moonwell state, not from model output. Requires
            ENABLE_MAINNET_TRANSACTION_PREPARATION and a completed, unexpired proof.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="strategy"
              checked={strategyType === "ADD_COLLATERAL"}
              onChange={() => setStrategyType("ADD_COLLATERAL")}
            />
            ADD_COLLATERAL
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="strategy"
              checked={strategyType === "REPAY_DEBT"}
              onChange={() => setStrategyType("REPAY_DEBT")}
            />
            REPAY_DEBT
          </label>
          <Button
            onClick={() => prepare.mutate()}
            disabled={!owns || wrongNetwork || prepare.isPending}
          >
            {prepare.isPending ? "Dry-running on a live Base fork…" : "Prepare signable plan"}
          </Button>
          {prepare.error ? <ErrorState error={prepare.error} title="Plan was not prepared" /> : null}
        </CardContent>
      </Card>

      {prepared.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Prepared calls
              <StatusBadge value={prepared.data.status} kind="strategy" />
            </CardTitle>
            <CardDescription className="font-mono break-all">{prepared.data.planHash}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {prepared.data.decodedCalls.map((call, index) => {
              const existing = prepared.data.txHashes[index];
              return (
                <div key={`${call.allowlistRuleId}-${index}`} className="grid gap-2 rounded-lg border border-border p-3">
                  <div className="font-medium">{call.functionName}</div>
                  <dl className="grid gap-1 font-mono text-xs">
                    <div>to {call.to}</div>
                    {call.spender ? <div>spender {call.spender}</div> : null}
                    {call.amountRaw ? <div>amount {formatTokenRaw(call.amountRaw, 6)} raw {call.amountRaw}</div> : null}
                    <div>rule {call.allowlistRuleId}</div>
                    {existing ? (
                      <a
                        href={explorerTx(8453, existing)}
                        className="underline-offset-4 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        tx {shortenHex(existing, 10, 8)}
                      </a>
                    ) : null}
                  </dl>
                  <Button
                    size="sm"
                    disabled={
                      !owns ||
                      wrongNetwork ||
                      Boolean(existing) ||
                      prepared.data.status === "FAILED" ||
                      send.isPending
                    }
                    onClick={() => send.mutate(index)}
                  >
                    {existing ? "Registered" : `Sign and send call ${index + 1}`}
                  </Button>
                </div>
              );
            })}
            {send.error ? <ErrorState error={send.error} title="Transaction was not registered" /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
