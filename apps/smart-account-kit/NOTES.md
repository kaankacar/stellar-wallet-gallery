# Smart Account Kit — implementation notes

`smart-account-kit@0.6.0` (pinned) — TypeScript SDK for OpenZeppelin smart-account
contracts on Stellar with WebAuthn passkey authentication. Contract-wallet kit:
the wallet is a per-user C-address contract instance whose entry points
self-authorize against its signers (passkey here).

## Doc sources actually used

- npm README for the exact published version:
  `npm view smart-account-kit@0.6.0 readme`
  (same as https://github.com/stellar/smart-account-kit README)
- Testnet/mainnet deployment manifest (contract IDs + WASM hashes):
  https://github.com/stellar/smart-account-kit/blob/main/docs/deployments-protocol-27-2026-07-09.md
- Reference browser demo (config pattern, connect/transfer flows):
  https://github.com/stellar/smart-account-kit/tree/main/demo
  (`demo/.env.example`, `demo/vite.config.ts`, `demo/src/config.ts`,
  `demo/src/hooks/useKit.ts`, `demo/src/hooks/useWalletSession.ts`)
- Published type declarations in the 0.6.0 tarball (`dist/kit.d.ts`,
  `dist/types.d.ts`, `dist/index.d.ts`) to confirm exact signatures.

## Exact API calls used

```ts
import { SmartAccountKit, LocalStorageAdapter } from "smart-account-kit";

const kit = new SmartAccountKit({
  rpcUrl,                    // https://soroban-testnet.stellar.org
  networkPassphrase,         // Test SDF Network ; September 2015
  accountWasmHash,           // required — WASM hash used to deploy each wallet
  webauthnVerifierAddress,   // required — deployed WebAuthn verifier contract
  relayerUrl,                // fee sponsoring via OpenZeppelin Relayer proxy
  storage: new LocalStorageAdapter("gallery-smart-account-kit"),
  rpName: "Stellar Wallet Gallery",
});

// Create: passkey ceremony + deploy a fresh smart-account contract.
// Returns CreateWalletResult & { submitResult?: TransactionResult }.
const r = await kit.createWallet(appName, userName, { autoSubmit: true });
// r.contractId (C-address), r.credentialId; check r.submitResult.success.

// Silent restore on page load (null when no stored session):
const restored = await kit.connectWallet(); // ConnectWalletResult | null

// Explicit "connect existing" (demo-app pattern, robust to indexer outages):
const { credentialId } = await kit.authenticatePasskey();
const contracts = await kit.discoverContractsByCredential(credentialId); // indexer, may be null
await kit.connectWallet(
  contracts?.length
    ? { contractId: contracts[0].contract_id, credentialId }
    : { credentialId }, // falls back to the deterministically derived address
);

// Native XLM transfer — direct SAC `transfer` invocation authorized by the
// smart account, passkey-signed, re-simulated, submitted. Amount is in TOKEN
// UNITS (e.g. 10 = 10 XLM), a number, per the published transfer() docs.
const result = await kit.transfer(nativeTokenContract, recipient, amountXlm);
// TransactionResult union: { success: true, hash, ledger? }
//                        | { success: false, error: SmartAccountError, hash? }
// Submission methods do NOT throw on expected on-chain/relayer failures.

await kit.disconnect(); // clears the stored session
```

Reconnect persistence: handled by the kit's `LocalStorageAdapter`
(`saveSession`/`getSession` under the `gallery-smart-account-kit` key), so a
reload silently reconnects via `kit.connectWallet()` — no custom localStorage
code in the app.

Balance / friendbot / explorer links come from `@gallery/shared`
(`getXlmBalance` reads the native SAC balance for C-addresses via RPC;
testnet friendbot funds C-addresses directly). The kit also offers
`kit.fundWallet(nativeTokenContract)` (temp account + friendbot + transfer),
but the shared helper is the gallery contract, so the app uses that.

## Testnet addresses (provenance: deployments-protocol-27-2026-07-09.md + demo/.env.example)

| Value | Address / hash |
|---|---|
| Account WASM hash | `1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a` |
| WebAuthn verifier | `CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F` |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Relayer proxy | `https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev` |

All public testnet infrastructure — **no credentials are required**, so the app
runs with no `.env` at all. `NeedsKeyBanner` only appears if someone explicitly
blanks a value in `.env`. The built-in testnet indexer (Mercury) is used for
credential → contract discovery with no token needed for public reads.

## Infrastructure the demo genuinely needs

- **Relayer (fee sponsoring), not Launchtube.** The kit's default deployer is a
  *shared, publicly-derivable* keypair that is sign-only: it signs the
  CreateContractV2 auth entry but never sources fees. A relayer/channel account
  must supply source/sequence/fees for deployment, and passkey `transfer()`
  submissions also route through it. The SDF-deployed testnet proxy (above,
  fronting OpenZeppelin Relayer Channels) is the default, so the demo is
  gasless out of the box. Alternatives: your own proxy (`relayer-proxy/` in the
  repo) or a custom `deployerSecret` (changes derived wallet addresses).
- **Stellar testnet RPC** (public).
- **Indexer** (optional): built-in Mercury testnet endpoint; when it is down the
  connect flow falls back to the derived contract address (pattern taken from
  the kit's own demo, which handled real Mercury 500s).

## Build caveats

- **Buffer polyfill required**: `@stellar/stellar-sdk` and the kit's `base64url`
  dependency expect Node's `Buffer`/`global`. Mirrored the kit demo's setup:
  `buffer` package + `globalThis.Buffer` assignment in `main.tsx`, plus
  `define: { global: "globalThis" }` in `vite.config.ts`.
- **Optional peer dep stubbed**: `smart-account-kit` dynamically imports
  `@creit-tech/stellar-wallets-kit` (a JSR-only package, *not* the npm
  `@creit.tech/...` one) inside its optional `StellarWalletsKitAdapter`
  (external-wallet/multi-signer flows we don't use). It is not installable from
  the default npm registry, so `vite.config.ts` aliases that specifier to an
  inert local stub (`src/stellar-wallets-kit-stub.ts`); the code path never
  executes.
- `@stellar/stellar-sdk` is not imported by the app directly (comes via
  `@gallery/shared` and the kit); `resolve.dedupe` keeps a single copy.

## Runtime caveats

- Passkeys require a WebAuthn-capable browser and a secure context
  (localhost is fine). The relying party ID defaults to the current domain, so
  passkeys created on one origin won't appear on another.
- `createWallet` deploys a *fresh contract per passkey* — creating twice yields
  two different C-addresses. "Connect existing" finds previous ones via the
  indexer, else derives the address from the credential ID (derivation only
  matches wallets created with the default shared deployer).
- Wallet addresses are deterministic from (deployer, credential ID); a custom
  `deployerSecret` breaks re-derivation of previously created wallets.
- Transfers enforce the account's context rules — if you add a spending-limit
  or threshold policy to the default rule (via `kit.policies` / `kit.rules`,
  not exercised in this minimal demo), `transfer()` failures come back as typed
  `ContractError`s (e.g. `SpendingLimitExceeded`), which the app surfaces via
  the `TransactionResult` error branch.
- The single-signer `kit.transfer()` path is passkey-only by design; Ed25519 or
  delegated G-address signers require `kit.multiSigners` (out of scope here).
