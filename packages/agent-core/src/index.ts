import { ForkError } from "@fork/shared";

export const GROQ_PLANNER_MODEL = "openai/gpt-oss-120b";
export const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

export const ALLOWED_TOOL_NAMES = [
  "get_wallet_positions",
  "get_change_details",
  "get_exposure",
  "run_impact_simulation",
  "list_available_rescue_assets",
  "optimize_repayment",
  "optimize_add_collateral",
  "get_verified_strategies",
  "compare_verified_strategies",
] as const;

export function runAgent(): never {
  throw new ForkError("NOT_IMPLEMENTED", "Groq agent loop is Phase 7");
}
