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
    const combined = `${home}\n${view}`;
    expect(combined).not.toMatch(/health factor|\$1,234|99\.99%/i);
    expect(view).toContain(
      "No dashboard numbers are shown until the API returns a real wallet snapshot",
    );
  });
});
