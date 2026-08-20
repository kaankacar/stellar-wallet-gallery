import type { SigningExplainerContent } from "@gallery/shared";

export const signingExplainer: SigningExplainerContent = {
  actors: [
    { id: "user", label: "You", icon: "🧑" },
    { id: "dapp", label: "This dApp", icon: "🖥️" },
    { id: "privy", label: "Privy SDK", icon: "🔮" },
    { id: "infra", label: "Privy key infra", icon: "🔐" },
    { id: "horizon", label: "Horizon", icon: "⛓️" },
  ],
  steps: [
    {
      from: "user",
      to: "privy",
      label: "Email / social login",
      detail:
        "login() opens Privy's modal. No wallet, no seed phrase — an email code or social account is the whole onboarding. Your app id and allowed origins are validated by auth.privy.io.",
    },
    {
      from: "privy",
      to: "infra",
      label: "Create Stellar wallet",
      detail:
        "Stellar is a Privy 'tier 2' extended chain: createWallet({ chainType: 'stellar' }) provisions an ed25519 key that Privy's infrastructure manages for the user. The dApp only ever sees the G-address.",
    },
    {
      from: "dapp",
      to: "dapp",
      label: "Build XDR + hash",
      detail:
        "The dApp builds the payment, then computes the exact 32 bytes Stellar signs: tx.hash() — the SHA-256 of the network-scoped transaction envelope.",
    },
    {
      from: "dapp",
      to: "infra",
      label: "signRawHash",
      detail:
        "useSignRawHash({ address, chainType: 'stellar', hash }) — Privy signs the raw hash with the embedded key inside its secure infrastructure. The key never reaches the browser tab's JavaScript.",
    },
    {
      from: "infra",
      to: "dapp",
      label: "Signature → attach",
      detail:
        "The ed25519 signature comes back as hex. The dApp converts it to base64 and attaches it with tx.addSignature(address, sig) — stellar-sdk verifies it client-side before accepting it.",
    },
    {
      from: "dapp",
      to: "horizon",
      label: "Submit",
      detail: "The signed envelope is a perfectly ordinary classic payment by the time Horizon sees it.",
    },
  ],
  setup: [
    { title: "Install", code: "pnpm add @privy-io/react-auth" },
    {
      title: "Get an app id",
      detail:
        "dashboard.privy.io → create an app. Add your URL to Settings → Clients → allowed origins.",
      code: "VITE_PRIVY_APP_ID=…",
    },
    {
      title: "Mount the provider",
      code: "<PrivyProvider appId={APP_ID}>",
    },
    {
      title: "Wallet (extended chains)",
      code: "import { useCreateWallet } from\n  '@privy-io/react-auth/extended-chains';\ncreateWallet({ chainType: 'stellar' });",
      detail: "Extended-chain wallets are not auto-created on login — create on first use.",
    },
    {
      title: "Sign",
      code: "const { signature } = await signRawHash({\n  address, chainType: 'stellar',\n  hash: `0x${tx.hash().toString('hex')}` });",
    },
  ],
  footnote:
    "Raw-hash signing is the low-level path: Privy signs exactly the 32 bytes you give it, so the dApp stays in full control of what the transaction contains.",
};
