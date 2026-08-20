# Privy — implementation notes

## Stellar support verdict

**Privy supports Stellar natively as a "tier 2" / extended chain** in
`@privy-io/react-auth@3.37.1`. That means:

- Embedded wallet creation with `chainType: 'stellar'` — Privy derives a real
  Stellar ed25519 key and a native **G-address** (`wallet.address`).
- **Raw hash signing** on the ed25519 curve (`useSignRawHash`). There is no
  higher-level "sign this Stellar transaction XDR" API on the client — the app
  computes the Stellar transaction hash itself and asks Privy to sign that
  32-byte hash. Per Privy's docs, raw sign "signs the provided hash directly
  without any additional byte manipulation", which is exactly a classic
  Stellar signature (ed25519 over the tx hash).
- Private key export (`useExportWallet` from the same entry point).
- Per the tier definition, tier 2 does **not** include Privy-built transaction
  sending/funding UIs — balance display, friendbot funding and Horizon
  submission are done by this app via `@gallery/shared`.

Doc sources actually used (docs.privy.io, checked 2026-08-17):

- https://docs.privy.io/wallets/overview/chains — tier table; Stellar is tier 2
  ("curve-level cryptographic signatures that can be used for transaction
  signing", wallet creation, key export).
- https://docs.privy.io/wallets/wallets/create/create-a-wallet — React:
  `useCreateWallet` from `@privy-io/react-auth/extended-chains`, e.g.
  `createWallet({chainType: 'stellar'})`.
- https://docs.privy.io/wallets/using-wallets/other-chains/raw-sign — React:
  `useSignRawHash` from `@privy-io/react-auth/extended-chains`;
  `signRawHash({address, chainType, hash})` with a `0x`-prefixed hex hash.
- https://docs.privy.io/recipes/use-tier-2 — end-to-end tier-2 recipe (its code
  is the **server** SDK `@privy-io/node`: `wallets().create({chain_type:
  'stellar'})` / `wallets().rawSign(...)` — same model, different surface).

The API surface below was additionally verified against the actual type
declarations shipped in the `@privy-io/react-auth@3.37.1` npm tarball
(`dist/dts/extended-chains.d.mts`), so the hook names and shapes are exact.

## Exact API surface used

From `@privy-io/react-auth` (main entry):

- `<PrivyProvider appId clientId? config?>` — `config.appearance.accentColor`
  set to the gallery accent `#6c5ce7`.
- `usePrivy()` → `{ ready, authenticated, user, login(), logout() }`.
  `login()` opens Privy's hosted modal (email / social / etc. as configured in
  the dashboard).
- `user.linkedAccounts` — the Stellar wallet persists across sessions as a
  `WalletWithMetadata` with `type === 'wallet' && chainType === 'stellar'`
  (also carries `publicKey`, which is tier-2-only metadata).

From `@privy-io/react-auth/extended-chains`:

- `useCreateWallet()` → `createWallet({ chainType: 'stellar' })` →
  `Promise<{ user, wallet }>`; `wallet.address` is the G-address. `'stellar'`
  is a member of `CurveSigningChainType` (from `@privy-io/api-types`).
- `useSignRawHash()` → `signRawHash({ address, chainType: 'stellar', hash:
  '0x…' })` → `Promise<{ signature: '0x…' }>` (hex-encoded 64-byte ed25519
  signature). Internally it resolves the embedded wallet from
  `user.linkedAccounts` by `chainType` + `address`, so the user must be
  authenticated and the wallet must belong to them.

## Payment signing flow (this app)

1. `buildPaymentXdr({source, destination, amount})` (`@gallery/shared`) —
   classic payment op, testnet passphrase.
2. `TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE)` and
   `tx.hash()` — the 32-byte hash of the `TransactionSignaturePayload`, i.e.
   exactly what Stellar signers sign.
3. `signRawHash({address, chainType: 'stellar', hash: '0x' + hex})`.
4. Convert the hex signature to base64 (`src/signing.ts`) and attach it with
   `tx.addSignature(address, signatureBase64)` — stellar-sdk derives the
   signature hint from the G-address and verifies the signature against the tx
   hash before attaching (so a bad signature fails fast, client-side).
5. `submitSignedXdr(tx.toXDR())` → Horizon testnet → stellar.expert link.

## Credentials / where to create a Privy app

- Create an app at **https://dashboard.privy.io** → copy the **App ID** into
  `VITE_PRIVY_APP_ID` (see `.env.example`). `VITE_PRIVY_CLIENT_ID` is optional
  and only needed if the app is configured to require a client ID.
- Add the dev origin (`http://localhost:5182`) to the app's **Allowed
  origins** in the dashboard, or logins will be rejected.
- Login methods (email, Google, etc.) are configured in the dashboard; this
  app deliberately does not override `config.loginMethods` (any method passed
  there must also be enabled server-side).
- The public docs do not describe a per-chain dashboard toggle for tier-2
  chains — `createWallet({chainType: 'stellar'})` is expected to work on a
  fresh app. If the API rejects wallet creation, check the app's plan /
  embedded-wallet settings in the dashboard; the error is surfaced in the UI.

## Caveats

- **No Stellar-aware signing UI**: Privy's modal shows nothing
  transaction-specific for raw-hash signing on extended chains — the user
  experience is "the app signs with the user's session". Good for demos;
  understand the trust model for production.
- **Extended-chain wallets are not auto-created on login** (unlike
  EVM/Solana's `embeddedWallets.createOnLogin` config). This app creates the
  Stellar wallet in an effect after first login, with a manual retry button if
  creation fails.
- The docs don't specify what `createWallet` does when a Stellar wallet
  already exists (error vs. additional wallet), so this app only calls it when
  no `chainType === 'stellar'` account is on the user, and surfaces any error.
- `usePrivy().user` can be briefly stale right after login while the Stellar
  wallet is created; the UI shows a "Creating your embedded Stellar wallet…"
  state.
- React: `@privy-io/react-auth@3.37.1` peer-accepts `react ^18 || ^19`, so
  this app stays on the gallery-standard React 18.3.1 (no React 19 needed).
- `@stellar/stellar-sdk` is a direct dependency here (not just via
  `@gallery/shared`) because the app itself calls `TransactionBuilder.fromXDR`
  / `tx.hash()` / `tx.addSignature`.
- The whole flow is testnet-only, per the gallery contract.
