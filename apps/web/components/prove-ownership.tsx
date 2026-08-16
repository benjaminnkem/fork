"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";
import { getAuthSession, logoutAuth, requestAuthNonce, verifyAuthSignature } from "@/lib/api";

export function ProveOwnership() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const prove = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect a wallet first");
      const issued = await requestAuthNonce(address);
      const signature = await signMessageAsync({ message: issued.message });
      return verifyAuthSignature({
        address,
        nonce: issued.nonce,
        signature,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
  });
  const logout = useMutation({
    mutationFn: logoutAuth,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
  });

  const proved =
    Boolean(session.data?.address) &&
    Boolean(address) &&
    session.data!.address.toLowerCase() === address!.toLowerCase();

  if (!isConnected || !address) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {proved ? (
        <>
          <span className="text-xs text-muted-foreground">Ownership proved</span>
          <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
            End session
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => prove.mutate()} disabled={prove.isPending}>
          {prove.isPending ? "Waiting for signature…" : "Prove ownership"}
        </Button>
      )}
      {prove.error ? <ErrorState error={prove.error} title="Ownership proof failed" /> : null}
    </div>
  );
}
