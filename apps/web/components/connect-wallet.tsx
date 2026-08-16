"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { expectedBaseChainId } from "@/lib/wagmi";
import { shortenHex } from "@/lib/format";

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== expectedBaseChainId;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrongNetwork ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => switchChain({ chainId: expectedBaseChainId })}
          >
            Switch to Base
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          {shortenHex(address)}
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={isPending}>
          Connect wallet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {connectors.map((connector) => (
          <DropdownMenuItem key={connector.uid} onClick={() => connect({ connector })}>
            {connector.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
