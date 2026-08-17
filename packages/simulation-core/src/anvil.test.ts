import { describe, expect, it } from "vitest";
import { hashesEqual, liveAnvilCount } from "./anvil.js";

describe("anvil helpers", () => {
  it("compares block hashes case-insensitively", () => {
    expect(
      hashesEqual(
        "0x587E0CAB88E0FD0929F24E36240BD4943E8162CAB4A42BB1064D48936FA2E8BC",
        "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
      ),
    ).toBe(true);
    expect(hashesEqual("0xaaa", "0xbbb")).toBe(false);
    expect(hashesEqual(null, "0xaaa")).toBe(false);
  });

  it("starts with no live anvil processes", () => {
    expect(liveAnvilCount()).toBe(0);
  });
});
