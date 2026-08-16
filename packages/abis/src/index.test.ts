import { describe, expect, it } from "vitest";
import { CURRENT_REGISTRY_VERSION, getRequiredContract, moonwellRegistry } from "./index.js";

describe("moonwell contract registry", () => {
  it("pins the Phase 0 research version", () => {
    expect(CURRENT_REGISTRY_VERSION).toBe("moonwell-core-2026-08-16");
    expect(moonwellRegistry.registryVersion).toBe(CURRENT_REGISTRY_VERSION);
  });

  it("requires the Base Comptroller and Ethereum governor", () => {
    expect(getRequiredContract(8453, "comptroller").address).toBe(
      "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",
    );
    expect(getRequiredContract(1, "multichainGovernor").address).toBe(
      "0x8769B70ac7c93AF0e75de0D69877709B66d75838",
    );
  });
});
