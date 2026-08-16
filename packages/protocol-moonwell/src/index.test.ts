import { describe, expect, it } from "vitest";
import { ForkError } from "@fork/shared";
import {
  createMoonwellAdapter,
  getMoonwellBaseComptroller,
  getMoonwellEthereumGovernor,
} from "./index.js";

describe("protocol-moonwell skeleton", () => {
  it("exposes verified registry addresses only", () => {
    expect(getMoonwellBaseComptroller()).toBe("0xfBb21d0380beE3312B33c4353c8936a0F13EF26C");
    expect(getMoonwellEthereumGovernor()).toBe("0x8769B70ac7c93AF0e75de0D69877709B66d75838");
  });

  it("does not implement adapter business logic in Phase 0", () => {
    expect(() => createMoonwellAdapter()).toThrow(ForkError);
  });
});
