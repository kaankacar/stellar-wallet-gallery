import type { SigningExplainerContent } from "@gallery/shared";

export const signingExplainer: SigningExplainerContent = {
  actors: [
    { id: "user", label: "You", icon: "🧑" },
    { id: "dapp", label: "This dApp", icon: "🖥️" },
    { id: "kit", label: "Wallets Kit", icon: "🔌" },
    { id: "wallet", label: "Your wallet", icon: "🦊" },
    { id: "horizon", label: "Horizon", icon: "⛓️" },
  ],
  steps: [
    {
      from: "dapp",
      to: "dapp",
      label: "Build payment XDR",
      detail:
        "The dApp loads the source account's sequence number from Horizon and builds a classic payment transaction. It leaves as unsigned XDR — just bytes, no secrets.",
    },
    {
      from: "dapp",
      to: "kit",
      label: "signTransaction(xdr)",
      detail:
        "One call, any wallet: StellarWalletsKit.signTransaction routes to whichever wallet the user picked in the connect modal. The dApp code is identical for all of them.",
    },
    {
      from: "kit",
      to: "wallet",
      label: "Route to the wallet",
      detail:
        "The kit speaks each wallet's own protocol — extension APIs (Freighter, xBull, Rabet), web signers (Albedo), Ledger transports, WalletConnect deep links — behind one interface.",
    },
    {
      from: "wallet",
      to: "user",
      label: "Approve prompt",
      detail:
        "The wallet shows the decoded transaction and asks for approval. This is the trust boundary: the private key lives in the wallet and never touches the dApp or the kit.",
    },
    {
      from: "wallet",
      to: "kit",
      label: "signedTxXdr",
      detail:
        "The wallet signs the transaction hash with the user's ed25519 key and hands the signed XDR back through the kit to the dApp.",
    },
    {
      from: "dapp",
      to: "horizon",
      label: "Submit",
      detail:
        "The dApp submits the signed envelope to Horizon. Stellar consensus confirms it in ~5 seconds — the hash links straight to stellar.expert.",
    },
  ],
  setup: [
    { title: "Install", code: "pnpm add @creit.tech/stellar-wallets-kit" },
    {
      title: "No API keys",
      detail: "Fully client-side. Nothing to sign up for, nothing to configure in a dashboard.",
    },
    {
      title: "Initialize once (v2 static API)",
      code: "StellarWalletsKit.init({\n  network: Networks.TESTNET,\n  modules: [...defaultModules()],\n});",
      detail:
        "v2 replaced the v1 instance API with a static class — and its internal default network is PUBLIC, so always pass the network explicitly.",
    },
    {
      title: "Connect",
      code: "const { address } =\n  await StellarWalletsKit.authModal();",
    },
    {
      title: "Sign",
      code: "const { signedTxXdr } =\n  await StellarWalletsKit.signTransaction(\n    xdr, { networkPassphrase, address });",
    },
  ],
  footnote:
    "Extension wallets must be installed, unlocked, and switched to Testnet themselves — the dApp can't pick the network for them.",
};
