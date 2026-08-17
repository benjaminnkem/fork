import { describe, expect, it } from "vitest";
import {
  PINNED_ADD_COLLATERAL_WALLET,
  PINNED_REPAY_WALLET,
  PINNED_REPLAY_FORK_BLOCK,
  PINNED_REPLAY_FORK_HASH,
  PINNED_REPLAY_WALLET,
} from "./replay.js";
import {
  loadMoonwell176Manifest,
  parseReplayManifest,
  receiptMatchesManifestAction,
} from "./manifest.js";

describe("moonwell-176 manifest", () => {
  it("loads committed anchors without result values", () => {
    const manifest = loadMoonwell176Manifest();
    expect(manifest.slug).toBe("moonwell-176");
    expect(manifest.proposalId).toBe("176");
    expect(BigInt(manifest.fork.blockNumber)).toBe(PINNED_REPLAY_FORK_BLOCK);
    expect(manifest.fork.blockHash.toLowerCase()).toBe(PINNED_REPLAY_FORK_HASH.toLowerCase());
    expect(manifest.wallets.historical.address.toLowerCase()).toBe(PINNED_REPLAY_WALLET.toLowerCase());
    expect(manifest.wallets.isolatedAddCollateral.address.toLowerCase()).toBe(
      PINNED_ADD_COLLATERAL_WALLET.toLowerCase(),
    );
    expect(manifest.wallets.repaySmoke.address.toLowerCase()).toBe(PINNED_REPAY_WALLET.toLowerCase());
    expect(manifest.wallets.shortfallCreated?.address.toLowerCase()).toBe(
      "0x0efc0653d4fc2218f27ba9bb5767c0c83af25ae6",
    );
  });

  it("rejects a manifest that embeds computed results", () => {
    const raw = {
      ...loadMoonwell176Manifest(),
      liquidityRaw: "1",
    };
    expect(() => parseReplayManifest(raw)).toThrow(/result field liquidityRaw/);
  });

  it("matches a recomputed receipt against action identifiers only", () => {
    const manifest = loadMoonwell176Manifest();
    const check = receiptMatchesManifestAction(
      {
        proposalId: "176",
        wallet: manifest.wallets.historical.address,
        replayGrade: "DESTINATION_EFFECT_REPLAY",
        fork: {
          blockNumber: BigInt(manifest.fork.blockNumber),
          blockHash: manifest.fork.blockHash,
        },
        before: { collateralFactorMantissa: manifest.action.beforeCollateralFactorMantissa },
        after: { collateralFactorMantissa: manifest.action.afterCollateralFactorMantissa },
        provenance: {
          comptroller: manifest.contracts.comptroller,
          temporalGovernor: manifest.contracts.temporalGovernor,
          market: manifest.contracts.market,
        },
      },
      manifest,
    );
    expect(check.match).toBe(true);
  });
});
