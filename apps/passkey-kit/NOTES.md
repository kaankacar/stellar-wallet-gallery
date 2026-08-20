# Passkey Kit — implementation notes

`passkey-kit@0.16.2` (pinned; it is also the current npm `latest`, published
2026-08-13). The repo moved from `kalepail/passkey-kit` to
**github.com/stellar/passkey-kit**. This is a contract-wallet kit: the wallet
is a Soroban smart contract (C-address) whose signer is a WebAuthn passkey.

## Sources actually used (all fetched & verified for 0.16.x)

- README summary: <https://github.com/stellar/passkey-kit> (raw `README.md`)
- SDK source (exact signatures): `src/kit.ts`, `src/types.ts`, `src/sac.ts`,
  `src/relayer.ts`, `src/server.ts`, `src/constants.ts`, `src/storage/index.ts`
  via `raw.githubusercontent.com/stellar/passkey-kit/main/...`
- Reference browser app: `demo/src/lib/{config,actions,submit,relayer-proxy}.ts`,
  `demo/.env.example`, `demo/.env.production`, `demo/vite.config.ts`,
  `demo/README.md`
- WASM hash manifest: `docs/deployments-testnet-2026-07-11.md`
- Relayer proxy (submission security model): `relayer-proxy/README.md`,
  `relayer-proxy/src/{index,constants}.ts`, `relayer-proxy/wrangler.toml`
- npm registry metadata for `passkey-kit@0.16.2` (deps/exports) and the
  `@openzeppelin/relayer-plugin-channels@0.20.0` + `sac-sdk@0.4.4` tarballs
  (wire protocol + generated client types)
- Live probes: `GET https://channels.openzeppelin.com/testnet/gen` (mints
  `{"apiKey": "..."}`), CORS preflight (allows any origin, `Authorization`
  header), and the SDF relayer-proxy health endpoints.

## Exact API surface used

```ts
import { MercuryIndexer, PasskeyKit, PasskeySigner, SACClient, SignerKey } from "passkey-kit";
import { LocalStorageAdapter } from "passkey-kit/storage";

const kit = new PasskeyKit({ rpcUrl, networkPassphrase, walletWasmHash, storage });

// register passkey + deploy smart wallet (signedTx = base64 deploy envelope)
const { keyIdBase64, contractId, signedTx } = await kit.createWallet(appName, userName);

// reconnect: stored keyId skips the WebAuthn discovery ceremony; otherwise
// resolution order is local storage → getContractId (Mercury) → derivation,
// then on-chain ownership + code-identity verification
const { keyIdBase64, contractId } = await kit.connectWallet({ keyId?, getContractId? });

// native XLM SAC transfer from the smart wallet (sac-sdk generated client)
const sac = new SACClient({ rpcUrl, networkPassphrase });
const token = sac.getSACClient(nativeSacId);
let at = await token.transfer({ from: contractId, to, amount: stroopsBigint }); // AssembledTransaction<null>
at = await kit.sign(at, new PasskeySigner(keyIdBase64)); // WebAuthn prompt

// balance: NOT via token.balance — the shared getXlmBalance() reads the SAC
// balance of the C-address through RPC, per the gallery contract.
```

- Native SAC id is computed with `Asset.native().contractId(NETWORK_PASSPHRASE)`
  → `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`, byte-identical
  to the id the upstream demo pins in `VITE_nativeContractId`.
- keyId persistence: the kit's own `LocalStorageAdapter`
  (`passkey-kit:credentials` in localStorage) — `createWallet` records
  keyId → contractId automatically; the app offers a one-click
  "Reconnect" for the most recent record.
- `MercuryIndexer.forNetwork({ rpc: kit.rpc }, NETWORK_PASSPHRASE)` provides
  the keyless keyId → wallet reverse lookup used by "Connect existing" on a
  fresh browser (hosted endpoint:
  `https://testnet.mercurydata.app/rest/passkey-indexer`, no token).

## Submission: Launchtube is gone — it's OpenZeppelin Channels now

In 0.16.x there is **no Launchtube** (no `launchtubeUrl`/`launchtubeJwt`
anywhere in the package). Fee-sponsored submission goes through **OpenZeppelin
Relayer Channels**. The SDK's `PasskeyServer`/`RelayerClient`
(`passkey-kit/server`) hold a relayer API key and are documented server-only,
so this browser app mirrors `PasskeyServer.send`'s routing verbatim (the
upstream demo does exactly the same in its browser `submit.ts`):

- single `invokeHostFunction` op without source-account auth → POST
  `{ params: { func, auth } }` (covers the wallet deploy and SAC transfers);
- everything else → POST `{ params: { xdr } }` (fee-bump of a signed envelope).

Endpoint: `https://channels.openzeppelin.com/testnet` (the SDK's
`CHANNELS_TESTNET_URL` constant; not re-exported from the package root, so it
is duplicated in `src/config.ts`). Auth: `Authorization: Bearer <apiKey>`.
Response: `{ success, data: { transactionId, hash, status } }`; success is the
SDK's exact terminal-status allowlist regex. Verified against
`@openzeppelin/relayer-plugin-channels@0.20.0` (`ChannelsClient` wraps the body
in `{ params }` and unwraps `{ success, data }`).

### Credentials needed at runtime: none

The managed **testnet** Channels endpoint mints API keys keylessly:
`GET https://channels.openzeppelin.com/testnet/gen` → `{ "apiKey": "..." }`
(verified live; CORS-open to any origin). This is the same mechanism
passkey-kit's own `relayer-proxy` worker uses for per-IP key minting. The app
mints one key on first submission, caches it in localStorage, and re-mints
once on a 401/403. Hence **no `.env` is required and no `NeedsKeyBanner` is
rendered** — `.env.example` documents optional overrides only
(`VITE_RELAYER_URL`, `VITE_RELAYER_API_KEY`, `VITE_WALLET_WASM_HASH`).

### Why not the SDF-hosted relayer-proxy worker

The repo's demo submits through
`https://passkey-kit-relayer-proxy.sdf-ecosystem.workers.dev`, but that worker
is deliberately restricted (verified in `relayer-proxy/src/index.ts` + its
tests): CORS allows only `https://passkey-kit-demo.pages.dev`, `{func,auth}`
targets must be a smart-wallet contract, and only
`add_signer/update_signer/remove_signer/upgrade` are sponsored — a SAC
`transfer` is explicitly rejected ("Wallet function is not allowlisted"). The
raw Channels service imposes no such per-contract allowlist (verified in the
plugin's validation code), so direct-to-Channels with a runtime-minted key is
the path that actually sponsors this app's transfers.

## walletWasmHash provenance

`fdefad64b96837147e1c333e51f537b696eab925e9f147e63d597c04e3c903f0` — the
canonical v1 smart-wallet WASM hash from the repo's hash manifest
`docs/deployments-testnet-2026-07-11.md` (re-pinned 2026-07-13 after the audit
hardening pass; upload tx
`3507c407bc3c6f7b6d5fc303f09228a4539a7737bad004fee9a2981b7cbb65af` on testnet).
The same value is pinned in the repo's `demo/.env.production` and in the
relayer-proxy's `ALLOWED_WALLET_WASM_HASHES`. Overridable via
`VITE_WALLET_WASM_HASH`.

## Caveats

- **WebAuthn needs a secure context**: `http://localhost:5184` qualifies;
  a LAN IP or plain-http host does not. Passkeys are scoped to the origin
  (`rpId` defaults to the current origin), so a wallet created on
  `localhost:5184` is only discoverable from that origin — and each gallery
  app port is a different origin with its own passkeys.
- `createWallet` registers the passkey **before** the deploy is submitted; if
  the relayer rejects the deploy the app calls `kit.disconnect()` and surfaces
  the error (the passkey remains in the authenticator — harmless).
- SAC `transfer` to a `G…` destination requires that account to already exist
  on-chain (fund it via friendbot first); a `C…` destination just needs to be
  a valid contract.
- The managed testnet Channels endpoint is rate-limited and testnet-only by
  policy (there is no keyless mainnet path); minted keys are throwaway,
  cached per browser, and re-minted on auth failure.
- Channels requires ≤30s time bounds on `{xdr}` submissions — satisfied
  automatically because the kit signs its deploy carrier with its own
  30s default timeout; `{func,auth}` submissions get their envelope rebuilt by
  the relayer, so the local timebound is irrelevant there.
- `buffer` is polyfilled in `src/polyfills.ts` (first import in `main.tsx`) and
  `global` is mapped to `globalThis` in `vite.config.ts`, mirroring the
  upstream demo's Vite setup (including `resolve.dedupe` for
  `@stellar/stellar-sdk`, so XDR `instanceof` checks hold across passkey-kit's
  generated sub-clients).
- Minor unverified detail: the exact expiry/lifetime of `/gen`-minted keys is
  undocumented; the 401/403 re-mint retry covers it.

## Live-verified incompatibility + workaround (2026-08-18)

passkey-kit 0.16.x signs auth entries with Protocol 27's address-bound
credentials (`sorobanCredentialsAddressV2`, discriminant 2, CAP-0071-02 — the
signed payload binds the wallet address). The managed Channels testnet
deployment (`channels.openzeppelin.com/testnet`) runs a pre-P27 stellar-sdk
and cannot parse them on EITHER lane, verified live:

- `{func,auth}` lane → HTTP 400 `INVALID_PARAMS`:
  "XDR Read Error: unknown SorobanCredentialsType member for value 2"
- `{xdr}` lane → HTTP 500 `TYPE_ERROR` with the same message (the plugin
  parses the envelope internally after accepting it)

Workaround implemented in `src/relayer.ts`: wallet **deploys** still ride the
sponsored Channels `{func,auth}` lane (their credentials are type 0/1 — works,
verified). **Transfers** (V2-signed) are rebuilt around a throwaway
friendbot-funded fee-source keypair (persisted in localStorage) and submitted
DIRECTLY via RPC (`prepareTransaction` keeps pre-signed auth entries by
design, then `sendTransaction` + `pollTransaction`). Still zero credentials —
just not fee-sponsored for transfers until OZ upgrades the hosted plugin.

End-to-end verified headlessly with a CDP virtual WebAuthn authenticator:
wallet CA5MM3YOBV6ONLFXGDO5NRSZFV6H22DNKX3R7CURKPYXWRNBIEV73TWP, transfer tx
2b5eaf21eb165d205d71dcd06b3ba2e05337533f9dfc82305922c0db10aed425 (successful
on Horizon testnet).
