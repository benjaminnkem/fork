import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "@fork/config";
import { AuthService } from "./auth.service.js";

describe("AuthService", () => {
  it("issues a nonce and accepts a matching signature once", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const auth = new AuthService(loadConfig({ NODE_ENV: "development", APP_ENV: "local" }), null);
    const issued = await auth.issueNonce(account.address);
    const signature = await account.signMessage({ message: issued.message });
    const session = await auth.verifySignature({
      address: account.address,
      nonce: issued.nonce,
      signature,
    });
    expect(session.address.toLowerCase()).toBe(account.address.toLowerCase());
    await expect(
      auth.verifySignature({
        address: account.address,
        nonce: issued.nonce,
        signature,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
