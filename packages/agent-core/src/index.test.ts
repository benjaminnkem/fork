import { describe, expect, it } from "vitest";
import { ALLOWED_TOOL_NAMES, GROQ_PLANNER_MODEL } from "./index.js";

describe("agent-core", () => {
  it("does not include arbitrary transaction tools", () => {
    expect(ALLOWED_TOOL_NAMES).not.toContain("send_transaction");
    expect(GROQ_PLANNER_MODEL).toBe("openai/gpt-oss-120b");
  });
});
