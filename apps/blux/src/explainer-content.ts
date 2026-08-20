import type { SigningExplainerContent } from "@gallery/shared";

export const signingExplainer: SigningExplainerContent = {
  actors: [
    { id: "user", label: "You", icon: "🧑" },
    { id: "dapp", label: "This dApp", icon: "🖥️" },
    { id: "blux", label: "Blux", icon: "🧩" },
    { id: "method", label: "Wallet / OAuth", icon: "👛" },
    { id: "horizon", label: "Horizon", icon: "⛓️" },
  ],
  steps: [
    {
      from: "dapp",
      to: "blux",
      label: "login()",
      detail:
        "useBlux().login() opens the Blux modal. Before anything else, Blux validates your app id server-side (api.blux.cc/auth/validate) — no valid id, no login.",
    },
    {
      from: "blux",
      to: "user",
      label: "Pick a door",
      detail:
        "One modal, many doors: a Stellar wallet (Freighter, xBull, Lobstr, Albedo, Ledger…), or non-crypto auth — email, phone, or a social account.",
    },
    {
      from: "user",
      to: "method",
      label: "Authenticate",
      detail:
        "The user completes whichever flow they chose. Blux normalizes the result into one session with a Stellar address — the dApp never cares which door was used.",
    },
    {
      from: "dapp",
      to: "blux",
      label: "signTransaction(xdr)",
      detail:
        "The dApp builds the payment XDR with the shared helpers, then hands it to Blux. This gallery deliberately uses sign-only (not Blux's sendTransaction) so every app submits the same way.",
    },
    {
      from: "method",
      to: "dapp",
      label: "Signed XDR",
      detail:
        "Blux routes the signing request to the authenticated method — the wallet prompts, or the auth-based signer signs — and the signed XDR comes back to the dApp.",
    },
    {
      from: "dapp",
      to: "horizon",
      label: "Submit",
      detail: "The signed envelope goes to Horizon testnet, same as every other tab in this gallery.",
    },
  ],
  setup: [
    { title: "Install", code: "pnpm add @bluxcc/react" },
    {
      title: "Get an app id",
      detail:
        "dashboard.blux.cc → create an app → copy its id. Blux validates it against its API on every auth call, so a real id is required.",
      code: "VITE_BLUX_APP_ID=…",
    },
    {
      title: "Mount the provider",
      code: '<BluxProvider config={{\n  appId,\n  networks: [networks.testnet],\n  appearance: { accentColor },\n}}>',
    },
    {
      title: "Log in",
      code: "const blux = useBlux();\nawait blux.login();\nblux.user?.address",
    },
    {
      title: "Sign",
      code: "await blux.signTransaction(xdr,\n  { network: NETWORK_PASSPHRASE });",
    },
  ],
  footnote:
    "Which doors show up in the modal depends on your dashboard app's enabled auth methods — and extension wallets only appear when installed.",
};
