import type { SigningExplainerContent } from "@gallery/shared";

export const signingExplainer: SigningExplainerContent = {
  actors: [
    { id: "user", label: "You", icon: "🧑" },
    { id: "dapp", label: "This dApp", icon: "🖥️" },
    { id: "para", label: "Para modal", icon: "🧩" },
    { id: "mpc", label: "MPC network", icon: "🧮" },
    { id: "horizon", label: "Horizon", icon: "⛓️" },
  ],
  steps: [
    {
      from: "user",
      to: "para",
      label: "Email / phone login",
      detail:
        "openModal() shows Para's embedded login. The API key (BETA_…) selects your project and environment — free developer keys run against Para's beta environment.",
    },
    {
      from: "para",
      to: "mpc",
      label: "Provision MPC wallet",
      detail:
        "createWallet({ type: 'STELLAR' }) — the ed25519 key is born as two shares, one held by the user's session, one by Para. The whole key never exists in one place, and there is no seed phrase.",
    },
    {
      from: "dapp",
      to: "dapp",
      label: "Build XDR",
      detail:
        "A standard payment build via the shared helpers. The address comes from useParaStellarSigner — pass the testnet passphrase explicitly, the hook defaults to PUBLIC.",
    },
    {
      from: "dapp",
      to: "mpc",
      label: "signTransactionXDR",
      detail:
        "stellarSigner.signTransactionXDR(xdr, passphrase) kicks off an MPC ceremony: both key shares jointly compute the ed25519 signature without either side ever seeing the full key.",
    },
    {
      from: "mpc",
      to: "dapp",
      label: "Signed XDR",
      detail: "The fully-signed envelope comes back to the dApp — indistinguishable from a locally-signed one.",
    },
    {
      from: "dapp",
      to: "horizon",
      label: "Submit",
      detail: "Same shared submit path as every tab. Stellar support in Para launched Aug 5, 2026.",
    },
  ],
  setup: [
    {
      title: "Install",
      code: "pnpm add @getpara/react-sdk\n  @getpara/stellar-sdk-v14-integration",
    },
    {
      title: "Get an API key",
      detail: "developer.getpara.com → create a project → copy the BETA_ key.",
      code: "VITE_PARA_API_KEY=BETA_…",
    },
    {
      title: "Mount the providers",
      code: "<QueryClientProvider client={qc}>\n  <ParaProvider paraClientConfig={{\n    apiKey, env: Environment.BETA }}>",
    },
    {
      title: "Log in",
      code: "const { openModal } = useModal();\nopenModal();",
    },
    {
      title: "Sign",
      code: "const signer = useParaStellarSigner({\n  networkPassphrase });\nawait signer.signTransactionXDR(\n  xdr, networkPassphrase);",
    },
  ],
  footnote:
    "MPC in one line: the signature is computed BY two key shares cooperating, not by a reassembled key — compromise one share and you still can't sign.",
};
