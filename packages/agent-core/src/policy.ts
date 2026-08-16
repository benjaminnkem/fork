import { getAddress } from "viem";
import { ForkError, type Address } from "@fork/shared";
import type { AllowedToolName } from "./names.js";
import { TOOL_ARG_SCHEMAS } from "./schemas.js";
import { isAllowedToolName } from "./tools.js";

export interface AuthorizedToolCall {
  name: AllowedToolName;
  args: Record<string, unknown>;
}

export function authorizeToolCall(input: {
  name: string;
  rawArguments: string;
  sessionWallet: Address;
}): AuthorizedToolCall {
  if (!isAllowedToolName(input.name)) {
    throw new ForkError("GROQ_INVALID_TOOL_CALL", `Tool '${input.name}' is not allowlisted`);
  }
  let parsed: unknown;
  try {
    parsed = input.rawArguments.trim() === "" ? {} : JSON.parse(input.rawArguments);
  } catch {
    throw new ForkError("GROQ_INVALID_TOOL_CALL", `Tool '${input.name}' arguments are not JSON`);
  }
  const schema = TOOL_ARG_SCHEMAS[input.name];
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ForkError("GROQ_INVALID_TOOL_CALL", `Tool '${input.name}' failed schema validation`, {
      details: { issues: result.error.issues },
    });
  }
  const args = result.data as Record<string, unknown>;
  if (typeof args.wallet === "string") {
    if (getAddress(args.wallet) !== getAddress(input.sessionWallet)) {
      throw new ForkError("GROQ_INVALID_TOOL_CALL", "Tool wallet does not match the session wallet");
    }
  }
  if (input.name === "get_change_details" && typeof args.proposalId === "string" && args.proposalId !== "176") {
    throw new ForkError("UNSUPPORTED_PROTOCOL_CHANGE", "Only proposal 176 is supported in V1");
  }
  return { name: input.name, args };
}

export function callFingerprint(name: string, args: unknown): string {
  return `${name}:${JSON.stringify(args)}`;
}
