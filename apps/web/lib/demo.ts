export interface DemoWallet {
  address: string;
  title: string;
  blurb: string;
  button: string;
}

export const DEMO_WALLET = "0x494c7fdb753c15b69fea2293e1b76567ca94462d";

export const SHORTFALL_DEMO_WALLET = "0x0EFC0653D4Fc2218f27ba9Bb5767C0c83aF25aE6";

export const DEMO_WALLETS: DemoWallet[] = [
  {
    address: SHORTFALL_DEMO_WALLET,
    title: "176 creates shortfall",
    blurb:
      "Real mwrsETH collateral at the fork block. Live risk can still be SAFE. Launch simulation to see Comptroller SAFE → SHORTFALL.",
    button: "Use shortfall demo",
  },
  {
    address: DEMO_WALLET,
    title: "Isolated Moonwell wallet",
    blurb:
      "Real Base position used to exercise ADD_COLLATERAL. Stays solvent after 176. Analysis still loads live Comptroller data.",
    button: "Use solvent demo",
  },
];

export const DEMO_WALLET_TITLE = DEMO_WALLETS[1]!.title;
export const DEMO_WALLET_BLURB = DEMO_WALLETS[1]!.blurb;
