"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeAddress } from "@/lib/api";
import { DEMO_WALLETS } from "@/lib/demo";
import { shortenHex } from "@/lib/format";
import { useAnalysisStore } from "@/lib/store";

export function AddressForm({
  initial,
  compact = false,
  showDemo = true,
}: {
  initial?: string;
  compact?: boolean;
  showDemo?: boolean;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const setAddress = useAnalysisStore((state) => state.setAddress);
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (raw: string, source: "paste" | "connected" | "demo") => {
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
      className="grid gap-4"
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
          aria-describedby={error ? "wallet-address-error" : compact ? undefined : "wallet-address-help"}
          className={compact ? undefined : "h-11 font-mono text-sm"}
        />
        {error ? (
          <p id="wallet-address-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : compact ? null : (
          <p id="wallet-address-help" className="text-sm text-muted-foreground">
            Connecting a wallet is separate and does not prove ownership.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{compact ? "Analyze" : "Analyze address"}</Button>
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
      {showDemo ? (
        <div className="grid gap-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Demo wallets</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO_WALLETS.map((demo) => (
              <Button
                key={demo.address}
                type="button"
                variant="secondary"
                className="h-auto flex-col items-start gap-1 px-3 py-2.5 text-left whitespace-normal"
                onClick={() => {
                  setValue(demo.address);
                  submit(demo.address, "demo");
                }}
              >
                <span>{demo.button}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {shortenHex(demo.address, 8, 6)}
                </span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
