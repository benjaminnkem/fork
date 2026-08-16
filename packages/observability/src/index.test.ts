import { describe, expect, it } from "vitest";
import { createLogger } from "./index.js";

describe("createLogger", () => {
  it("creates a named pino logger", () => {
    const logger = createLogger({ name: "api", service: "api" });
    expect(logger.bindings().name).toBe("api");
    expect(logger.bindings().service).toBe("api");
  });
});
