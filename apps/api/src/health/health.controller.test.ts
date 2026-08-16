import { describe, expect, it } from "vitest";
import { loadConfig } from "@fork/config";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports live ok and ready as degraded without RPC clients", async () => {
    const controller = new HealthController(loadConfig({ NODE_ENV: "test", APP_ENV: "test" }), {});
    expect(controller.live().status).toBe("ok");
    const ready = await controller.ready();
    expect(ready.status).toBe("degraded");
    expect(ready.checks.mongodb).toBe("not_configured");
    expect(ready.checks.baseRpc).toBe("not_configured");
  });
});
