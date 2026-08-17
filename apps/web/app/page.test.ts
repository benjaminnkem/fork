import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatTokenRaw } from "../lib/format";

describe("formatTokenRaw", () => {
  it("formats with integer division only", () => {
    expect(formatTokenRaw("100236208", 6)).toBe("100.236208");
    expect(formatTokenRaw("1", 6)).toBe("0.000001");
    expect(formatTokenRaw("-1500000000000000000", 18)).toBe("-1.5");
    expect(formatTokenRaw("0", 18)).toBe("0");
  });
});

describe("product copy", () => {
  it("does not ship placeholder financial figures", () => {
    const home = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const view = readFileSync(new URL("../components/home-view.tsx", import.meta.url), "utf8");
    const form = readFileSync(new URL("../components/address-form.tsx", import.meta.url), "utf8");
    const demo = readFileSync(new URL("../lib/demo.ts", import.meta.url), "utf8");
    const combined = `${home}\n${view}\n${form}`;
    expect(combined).not.toMatch(/health factor|\$1,234|99\.99%/i);
    expect(view).toContain(
      "No dashboard numbers are shown until the API returns a real wallet snapshot",
    );
    expect(form).toContain("DEMO_WALLETS");
    expect(demo).toContain("Use shortfall demo");
    expect(demo).toContain("Use solvent demo");
    expect(demo).toContain("0x494c7fdb753c15b69fea2293e1b76567ca94462d");
    expect(demo).toContain("0x0EFC0653D4Fc2218f27ba9Bb5767C0c83aF25aE6");
  });
});
