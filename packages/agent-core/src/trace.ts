export type AgentTraceType =
  | "OBSERVATION"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "TOOL_REJECTED"
  | "STRATEGY_VERIFIED"
  | "STRATEGY_REJECTED"
  | "DECISION_SUMMARY"
  | "FINAL_SELECTION"
  | "MODEL_FALLBACK"
  | "FAILED";

export interface AgentTraceEvent {
  type: AgentTraceType;
  summary: string;
  toolName?: string;
  ok?: boolean;
}

export function sanitizeUserText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel\|>[\s\S]*?<\|message\|>/g, "")
    .replace(/^\s*reasoning:.*$/gim, "")
    .trim();
}

export function wrapUntrusted(label: string, value: unknown): string {
  return `<<UNTRUSTED_PROTOCOL_DATA label="${label}">>${JSON.stringify(value)}<</UNTRUSTED_PROTOCOL_DATA>>`;
}
