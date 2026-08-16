import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "wallet must be a 20-byte hex address");

export const optionalWalletSchema = z.object({
  wallet: addressSchema.optional(),
});

export const TOOL_ARG_SCHEMAS = {
  get_wallet_positions: optionalWalletSchema,
  get_change_details: z.object({
    proposalId: z.string().regex(/^\d+$/).optional(),
  }),
  get_exposure: optionalWalletSchema,
  run_impact_simulation: optionalWalletSchema,
  list_available_rescue_assets: optionalWalletSchema,
  optimize_repayment: optionalWalletSchema,
  optimize_add_collateral: optionalWalletSchema,
  get_verified_strategies: z.object({}),
  compare_verified_strategies: optionalWalletSchema,
} as const;
