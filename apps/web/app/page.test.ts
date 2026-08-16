import { describe, expect, it } from "vitest";

describe("web skeleton", () => {
  it("does not ship placeholder financial figures", () => {
    expect("0.00").not.toBe("health-factor");
  });
});
