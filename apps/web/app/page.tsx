export default function Page() {
  return (
    <main>
      <h1>Fork</h1>
      <p>
        Autonomous DeFi pre-execution risk agent. It applies a known protocol change to a pinned
        mainnet fork, reads risk from the protocol contracts, and only surfaces rescue actions the
        EVM verifies.
      </p>
      <p className="rule">
        Phase 0 skeleton. Wallet analysis, governance indexing, and simulation are not wired yet.
        No dashboard numbers are shown because none have been read from chain.
      </p>
      <p>
        Core rule: <code>The model proposes. The EVM proves.</code>
      </p>
    </main>
  );
}
