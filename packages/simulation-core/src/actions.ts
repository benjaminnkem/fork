import { parseEther, type Address, type Hex } from "viem";
import type { AnvilInstance } from "./anvil.js";

export interface ImpersonationRecord {
  account: Address;
  reason: string;
  fundedWei: string;
}

export interface SimulatedCallRecord {
  to: Address;
  data: Hex;
  value: string;
  from: Address;
  hash?: Hex;
  success: boolean;
  error?: string;
}

export async function impersonateForGas(
  instance: AnvilInstance,
  account: Address,
  reason: string,
  minWei: bigint = parseEther("1"),
): Promise<ImpersonationRecord> {
  await instance.client.impersonateAccount({ address: account });
  const current = await instance.client.getBalance({ address: account });
  if (current >= minWei) {
    return { account, reason, fundedWei: "0" };
  }
  await instance.client.setBalance({ address: account, value: minWei });
  return { account, reason, fundedWei: minWei.toString() };
}

export async function impersonateAndFund(
  instance: AnvilInstance,
  account: Address,
  reason: string,
): Promise<ImpersonationRecord> {
  await instance.client.impersonateAccount({ address: account });
  const fundedWei = parseEther("10");
  await instance.client.setBalance({ address: account, value: fundedWei });
  return { account, reason, fundedWei: fundedWei.toString() };
}

export async function sendImpersonatedCall(
  instance: AnvilInstance,
  from: Address,
  to: Address,
  data: Hex,
  value: bigint,
): Promise<SimulatedCallRecord> {
  try {
    const hash = await instance.client.sendTransaction({
      account: from,
      to,
      data,
      value,
    });
    const receipt = await instance.client.waitForTransactionReceipt({ hash });
    return {
      to,
      data,
      value: value.toString(),
      from,
      hash,
      success: receipt.status === "success",
      error: receipt.status === "success" ? undefined : "transaction reverted",
    };
  } catch (error) {
    return {
      to,
      data,
      value: value.toString(),
      from,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
