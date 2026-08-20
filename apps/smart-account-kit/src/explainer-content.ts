import type { SigningExplainerContent } from "@gallery/shared";

export const signingExplainer: SigningExplainerContent = {
  actors: [
    { id: "user", label: "You + Touch ID", icon: "🧑" },
    { id: "dapp", label: "This dApp", icon: "🖥️" },
    { id: "kit", label: "smart-account-kit", icon: "🛡️" },
    { id: "device", label: "Secure enclave", icon: "📱" },
    { id: "relayer", label: "OZ Relayer", icon: "🛰️" },
    { id: "network", label: "Network", icon: "⛓️" },
  ],
  steps: [
    {
      from: "dapp",
      to: "kit",
      label: "kit.transfer(sac, to, xlm)",
      detail:
        "One call. The kit builds a native-XLM SAC transfer authorized by the OpenZeppelin smart account — a C-address contract that can hold passkey, Ed25519, AND delegated signers with authorization policies.",
    },
    {
      from: "kit",
      to: "device",
      label: "WebAuthn challenge",
      detail:
        "The kit derives the authorization payload for the transfer and requests a passkey assertion through the browser's WebAuthn API.",
    },
    {
      from: "device",
      to: "user",
      label: "Biometric prompt",
      detail:
        "Touch ID / Face ID approves. The secp256r1 key stays in the secure enclave — the browser only ever sees the signed assertion.",
    },
    {
      from: "device",
      to: "kit",
      label: "Assertion → credentials",
      detail:
        "The WebAuthn signature is packed into the auth entry's address credentials for the smart account, ready for on-chain verification.",
    },
    {
      from: "kit",
      to: "relayer",
      label: "Sponsored submit",
      detail:
        "The SDF testnet relayer proxy (an OpenZeppelin Relayer with channel accounts) wraps the transaction and pays ALL fees — the smart account needs zero XLM for gas. This is fee sponsorship as infrastructure.",
    },
    {
      from: "network",
      to: "network",
      label: "Verifier checks on-chain",
      detail:
        "The account contract validates the WebAuthn signature through the shared verifier contract and enforces any signer policies (spending rules, delegated scopes) before the transfer executes.",
    },
  ],
  setup: [
    { title: "Install", code: "pnpm add smart-account-kit" },
    {
      title: "No API keys",
      detail:
        "Public testnet defaults are baked into the kit's docs: account WASM hash, WebAuthn verifier contract, and SDF's fee-sponsoring relayer proxy.",
    },
    {
      title: "Initialize",
      code: "const kit = new SmartAccountKit({\n  rpcUrl, networkPassphrase,\n  accountWasmHash,\n  webauthnVerifierAddress,\n  relayerUrl, storage });",
    },
    {
      title: "Create the account",
      code: "await kit.createWallet(app, user,\n  { autoSubmit: true });",
      detail: "Registers a passkey and deploys the smart-account contract, fees sponsored.",
    },
    {
      title: "Sign a transfer",
      code: "const result = await kit.transfer(\n  nativeSAC, recipient, amountXlm);\n// { success, hash } — never throws",
    },
  ],
  footnote:
    "Same passkey UX as the Passkey Kit tab, different architecture underneath: OpenZeppelin's audited smart-account contracts with multi-signer support and policy hooks, submission through OZ Relayer instead of direct RPC.",
};
