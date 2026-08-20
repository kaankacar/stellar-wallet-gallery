import type { SigningExplainerContent } from "@gallery/shared";

export const signingExplainer: SigningExplainerContent = {
  actors: [
    { id: "user", label: "You + Touch ID", icon: "🧑" },
    { id: "dapp", label: "This dApp", icon: "🖥️" },
    { id: "kit", label: "passkey-kit", icon: "🔑" },
    { id: "device", label: "Secure enclave", icon: "📱" },
    { id: "contract", label: "Smart wallet C…", icon: "📜" },
    { id: "network", label: "Soroban RPC", icon: "⛓️" },
  ],
  steps: [
    {
      from: "dapp",
      to: "kit",
      label: "SACClient.transfer",
      detail:
        "The wallet IS a Soroban contract (a C-address). Sending XLM is a SEP-41 transfer call on the native asset contract; simulation returns an auth entry the smart wallet must authorize.",
    },
    {
      from: "kit",
      to: "device",
      label: "kit.sign → WebAuthn",
      detail:
        "PasskeyKit.sign hashes the auth entry into a WebAuthn challenge and requests a passkey assertion from the browser — the same API that logs you into websites.",
    },
    {
      from: "device",
      to: "user",
      label: "Biometric prompt",
      detail:
        "Touch ID / Face ID. The secp256r1 private key was generated inside the device's secure enclave when the wallet was created, and it can never be exported — not even by you.",
    },
    {
      from: "device",
      to: "kit",
      label: "secp256r1 assertion",
      detail:
        "The assertion (authenticator_data + client_data_json + signature) is packed into the auth entry's Protocol 27 address-bound (V2) credentials — the signature is cryptographically tied to THIS wallet's address.",
    },
    {
      from: "dapp",
      to: "network",
      label: "Submit via fee source",
      detail:
        "A throwaway friendbot-funded account wraps the invoke, pays the fee, and submits via RPC (see the footnote for why the sponsored relayer lane is skipped for transfers).",
    },
    {
      from: "contract",
      to: "network",
      label: "__check_auth verifies",
      detail:
        "On-chain, the wallet contract's __check_auth verifies the WebAuthn signature against the passkey public key it stores. Wrong device, wrong signature, wrong wallet → the transaction fails. The chain is the verifier.",
    },
  ],
  setup: [
    { title: "Install", code: "pnpm add passkey-kit" },
    {
      title: "No API keys",
      detail:
        "Wallet deploys are fee-sponsored through OpenZeppelin Relayer Channels, whose testnet endpoint mints API keys keylessly at runtime.",
    },
    {
      title: "Initialize",
      code: "const kit = new PasskeyKit({\n  rpcUrl, networkPassphrase,\n  walletWasmHash, storage });",
    },
    {
      title: "Create the wallet",
      code: "const { contractId, signedTx } =\n  await kit.createWallet(app, user);\nawait submit(signedTx); // sponsored",
      detail: "One biometric prompt registers the passkey AND deploys the contract wallet it controls.",
    },
    {
      title: "Sign a transfer",
      code: "let at = await token.transfer({\n  from, to, amount });\nat = await kit.sign(at,\n  new PasskeySigner(keyId));",
    },
  ],
  footnote:
    "Gallery war story: passkey-kit 0.16 signs with Protocol 27 V2 credentials, which the hosted OZ Channels relayer can't parse yet ('unknown SorobanCredentialsType member for value 2') — found live while building this demo. Transfers therefore submit via direct RPC; details in this app's NOTES.md.",
};
