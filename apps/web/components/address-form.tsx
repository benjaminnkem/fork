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
            Paste any Base address for read-only Moonwell analysis. Connecting a wallet is separate
            and does not prove ownership.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size={compact ? "default" : "lg"}>
          Analyze address
        </Button>
        <Button
          type="button"
          variant="outline"
          size={compact ? "default" : "lg"}
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
        <div className="grid gap-3">
          {DEMO_WALLETS.map((demo) => (
            <div
              key={demo.address}
              className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
            >
              <div className="grid gap-1">
                <p className="text-sm font-medium">{demo.title}</p>
                <p className="text-sm text-muted-foreground">{demo.blurb}</p>
                <p className="font-mono text-xs text-muted-foreground">{shortenHex(demo.address, 8, 6)}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size={compact ? "default" : "lg"}
                onClick={() => {
                  setValue(demo.address);
                  submit(demo.address, "demo");
                }}
              >
                {demo.button}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}
