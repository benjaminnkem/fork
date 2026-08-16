import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { WalletAnalysis } from "@/components/wallet-analysis";
import { normalizeAddress } from "@/lib/api";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return (
      <EmptyState
        title="Invalid address"
        description="The path is not a 20-byte hex address. Paste a Base address from the home page."
      />
    );
  }
  return (
    <Suspense>
      <WalletAnalysis address={normalized} />
    </Suspense>
  );
}
