import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { authMessage, createNonce, signSession, verifySession } from "./session.js";

describe("wallet session", () => {
  it("signs and verifies a session token", () => {
    const payload = {
      v: 1 as const,
      address: "0x494c7fdb753c15b69fea2293e1b76567ca94462d" as const,
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = signSession(payload, "test-secret");
    expect(verifySession(token, "test-secret")?.address.toLowerCase()).toBe(payload.address);
    expect(verifySession(token, "other-secret")).toBeUndefined();
  });

  it("rejects expired sessions", () => {
    const token = signSession(
      {
        v: 1,
        address: "0x494c7fdb753c15b69fea2293e1b76567ca94462d",
        iat: 1,
        exp: 1,
      },
      "test-secret",
    );
    expect(verifySession(token, "test-secret")).toBeUndefined();
  });
});

describe("auth message", () => {
  it("is signed by the claimed wallet and not another wallet", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const other = privateKeyToAccount(generatePrivateKey());
    const nonce = createNonce();
    const message = authMessage({
      address: account.address,
      nonce,
      domain: "http://localhost:3000",
      issuedAt: "2026-08-16T00:00:00.000Z",
      expirationTime: "2026-08-16T00:05:00.000Z",
    });
    const signature = await account.signMessage({ message });
    expect(await verifyMessage({ address: account.address, message, signature })).toBe(true);
    expect(await verifyMessage({ address: other.address, message, signature })).toBe(false);
  });
});
