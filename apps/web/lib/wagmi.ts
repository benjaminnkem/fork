import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const chainId = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID ?? "8453");

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    ...(walletConnectId
      ? [
          walletConnect({
            projectId: walletConnectId,
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

export const expectedBaseChainId = Number.isFinite(chainId) ? chainId : 8453;
