import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeFunctionData, parseAbi } from "viem";
import {
  classifySelector,
  decodeGovernorProposalData,
  decodePublishMessagePayload,
} from "./decode.js";

const publishAbi = parseAbi([
  "function publishMessage(uint32 nonce, bytes payload, uint8 consistencyLevel)",
]);
const cfAbi = parseAbi(["function _setCollateralFactor(address,uint256)"]);

describe("governance decode", () => {
  it("classifies only the verified CF selector", () => {
    expect(classifySelector("0xe4028eee")).toBe("COLLATERAL_FACTOR_CHANGE");
    expect(classifySelector("0xdeadbeef")).toBe("UNKNOWN");
  });

  it("decodes a Wormhole Temporal Governor batch with a CF call", () => {
    const market = "0xfC41B49d064Ac646015b459C522820DB9472F4B5";
    const comptroller = "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C";
    const tg = "0x8b621804a7637b781e2BbD58e256a591F2dF7d51";
    const cfData = encodeFunctionData({
      abi: cfAbi,
      functionName: "_setCollateralFactor",
      args: [market, 520000000000000000n],
    });
    const payload = encodeAbiParameters(
      [
        { type: "address" },
        { type: "address[]" },
        { type: "uint256[]" },
        { type: "bytes[]" },
      ],
      [tg, [comptroller], [0n], [cfData]],
    );
    const calldata = encodeFunctionData({
      abi: publishAbi,
      functionName: "publishMessage",
      args: [0, payload, 1],
    });
    const batch = decodePublishMessagePayload(calldata);
    expect(batch?.temporalGovernor).toBe(tg);
    expect(batch?.calls[0]?.decoded?.functionName).toBe("_setCollateralFactor");
    expect(batch?.calls[0]?.decoded?.args[0]).toBe(market);
    expect(batch?.calls[0]?.decoded?.args[1]).toBe("520000000000000000");

    const proposal = decodeGovernorProposalData(176n, ["0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B"], [0n], [calldata], 1);
    expect(proposal.destinationBatches).toHaveLength(1);
  });

  it("returns undefined instead of guessing an unknown payload", () => {
    expect(decodePublishMessagePayload("0xb19a437e00000000")).toBeUndefined();
  });
});
