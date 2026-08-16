import { explorerAddress, explorerBlock, explorerTx, shortenHex } from "@/lib/format";
import type { JsonEvidence } from "@/lib/api";

export function EvidenceList({ evidence }: { evidence: JsonEvidence[] }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence references were returned.</p>;
  }
  return (
    <ul className="grid gap-2 font-mono text-xs">
      {evidence.map((item, index) => {
        const href =
          item.txHash
            ? explorerTx(item.chainId, item.txHash)
            : item.blockNumber
              ? explorerBlock(item.chainId, item.blockNumber)
              : item.address
                ? explorerAddress(item.chainId, item.address)
                : undefined;
        const label = [
          item.type,
          item.method,
          item.txHash ? shortenHex(item.txHash, 10, 6) : undefined,
          item.blockNumber ? `block ${item.blockNumber}` : undefined,
          item.address ? shortenHex(item.address) : undefined,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={`${item.type}-${index}-${label}`}>
            {href ? (
              <a href={href} className="underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                {label}
              </a>
            ) : (
              label
            )}
          </li>
        );
      })}
    </ul>
  );
}
