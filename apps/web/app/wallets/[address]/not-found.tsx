import { EmptyState } from "@/components/empty-state";

export default function WalletNotFound() {
  return (
    <EmptyState
      title="Invalid address"
      description="The path is not a 20-byte hex address. Paste a Base address from the home page."
    />
  );
}
