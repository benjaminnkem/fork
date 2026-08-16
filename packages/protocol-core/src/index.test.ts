import { describe, expect, it } from "vitest";
import { assertAdapterContract } from "./index.js";

describe("protocol-core", () => {
  it("reads a protocol id from an adapter-shaped object", () => {
    expect(assertAdapterContract({ protocolId: "moonwell" } as never)).toBe("moonwell");
  });
});
