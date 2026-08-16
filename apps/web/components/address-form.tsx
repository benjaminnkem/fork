"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeAddress } from "@/lib/api";
import { useAnalysisStore } from "@/lib/store";

export function AddressForm({ initial }: { initial?: string }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const setAddress = useAnalysisStore((state) => state.setAddress);
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (raw: string, source: "paste" | "connected") => {
    const normalized = normalizeAddress(raw);
    if (!normalized) {
      setError("Enter a valid 20-byte Base address");
      return;
    }
    setError(null);
    setAddress(normalized, source);
    router.push(`/wallets/${normalized}`);
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit(value, "paste");
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="wallet-address">Base address</Label>
        <Input
          id="wallet-address"
          name="wallet"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="0x…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "wallet-address-error" : undefined}
        />
        {error ? (
          <p id="wallet-address-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Paste any Base address for read-only Moonwell analysis. Connecting a wallet is separate
            and does not prove ownership.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Analyze address</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!isConnected || !address}
          onClick={() => {
            if (address) {
              setValue(address);
              submit(address, "connected");
            }
          }}
        >
          Use connected wallet
        </Button>
      </div>
    </form>
  );
}
