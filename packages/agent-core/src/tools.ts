import { ALLOWED_TOOL_NAMES, type AllowedToolName } from "./names.js";
import type { ProviderToolSpec } from "./provider.js";

const walletProp = {
  type: "string",
  description: "Optional Base wallet. Must match the session wallet if provided.",
};

export const TOOL_SPECS: ProviderToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_wallet_positions",
      description:
        "Read the session wallet Moonwell Core positions and Comptroller risk at the pinned Base block. Does not calculate solvency.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_change_details",
      description:
        "Read the pinned Moonwell governance change (proposal 176 unless another numeric id is supported).",
      parameters: {
        type: "object",
        properties: {
          proposalId: {
            type: "string",
            description: "Numeric proposal id. Only 176 is supported in V1.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_exposure",
      description: "Deterministically match the wallet positions to the pinned change.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_impact_simulation",
      description:
        "Replay the pinned Base destination effect on an Anvil fork and return Comptroller before/after risk.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_available_rescue_assets",
      description:
        "List real wallet balances that can be used for REPAY_DEBT or ADD_COLLATERAL. Does not mint assets.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "optimize_repayment",
      description:
        "Search the minimum REPAY_DEBT amount on a reset Anvil branch. Only verified if post-state policy passes.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "optimize_add_collateral",
      description:
        "Search the minimum ADD_COLLATERAL amount on a reset Anvil branch. Only verified if post-state policy passes.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_verified_strategies",
      description: "Return strategy search results already produced in this session.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_verified_strategies",
      description: "Run both V1 strategies and compare their verified/infeasible results.",
      parameters: {
        type: "object",
        properties: { wallet: walletProp },
        additionalProperties: false,
      },
    },
  },
];

export function isAllowedToolName(name: string): name is AllowedToolName {
  return (ALLOWED_TOOL_NAMES as readonly string[]).includes(name);
}
