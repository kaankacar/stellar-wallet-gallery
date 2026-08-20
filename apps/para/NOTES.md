# Para (`@getpara/react-sdk@3.14.0`) — implementation notes

Para (getpara.com) is MPC embedded-wallet infrastructure; it launched Stellar
support on **Aug 5, 2026** (https://blog.getpara.com/stellar-support/).

## Sources actually used

- https://blog.getpara.com/stellar-support/ — launch post; points to the Stellar
  setup guide below.
- https://docs.getpara.com/v3/react/setup/vite — Vite setup: install command,
  required `vite-plugin-node-polyfills`, `QueryClientProvider` + `ParaProvider`
  with `paraClientConfig.apiKey`, required `import "@getpara/react-sdk/styles.css"`,
  `useModal()` to open the auth modal, API keys from https://developer.getpara.com.
- https://docs.getpara.com/v3/react/guides/web3-operations/stellar/setup-libraries —
  install `@getpara/stellar-sdk-v14-integration` + `@stellar/stellar-sdk`; signer
  via the hook (React) or `createParaStellarSigner({ para, networkPassphrase })`.
- https://docs.getpara.com/v3/react/guides/web3-operations/stellar/send-tokens —
  payment flow: `TransactionBuilder` + `Operation.payment` → sign → submit.
- https://docs.getpara.com/v3/general/developer-portal-setup — projects/API keys;
  `BETA_` keys for development, `PROD_` keys for production; wallet types are
  enabled per project in the portal.
- Shipped type definitions and dist sources of the pinned npm packages (ground
  truth for 3.14.0, extracted from the tarballs): `@getpara/react-sdk`,
  `@getpara/react-sdk-lite`, `@getpara/react-core`, `@getpara/core-sdk`,
  `@getpara/stellar-sdk-v14-integration` (`dist/types/stellarSigner.d.ts`),
  `@getpara/shared` (`WALLET_TYPES`), `@getpara/web-sdk`.

## Exact packages

- `@getpara/react-sdk` **3.14.0** (pinned) — provider, modal, hooks. Hard peer
  deps: `@tanstack/react-query >= 5`, `viem >= 2` (both added to this app;
  `wagmi` is an optional peer and is omitted).
- `@getpara/stellar-sdk-v14-integration` **3.14.0** — Para's Stellar signer. It
  is also a direct dependency of the react-sdk, but the Stellar hook declares it
  (plus `@stellar/stellar-sdk`) as peers the app must install, and the docs'
  install command does the same, so it is declared explicitly.
- `@stellar/stellar-sdk` **^14.6.1** — the integration's peer range is `^14.0.0`
  (hence the package name "v14"), NOT the `^16.x` the shared package uses. The
  app itself never imports it; only Para's signer does. Signed/unsigned XDR
  strings cross the app boundary, so the two SDK majors coexist fine (classic
  payment XDR is stable across those versions; pnpm resolves each package's own
  dependency).
- `vite-plugin-node-polyfills` (dev) — required by Para's Vite guide; the SDK
  and the signer use Node globals (`Buffer`) in the browser.

## API surface used

```tsx
import {
  Environment,             // enum: DEV | SANDBOX | BETA | PROD
  ParaProvider,            // embeds the Para modal by default
  useModal,                // { openModal, closeModal, isOpen }
  useAccount,              // { isConnected, isLoading, embedded: { email, userId, wallets, … } }
  useLogout,               // { logout, logoutAsync }
  useCreateWallet,         // { createWallet, createWalletAsync } — params { type?: 'EVM'|'SOLANA'|'COSMOS'|'STELLAR'|'SUI' }
  useParaStellarSigner,    // { stellarSigner, isLoading, refetch, … } (react-query result)
} from "@getpara/react-sdk";

<QueryClientProvider client={queryClient}>
  <ParaProvider
    paraClientConfig={{ apiKey, env: Environment.BETA }}
    config={{ appName: "Stellar Wallet Gallery" }}
  >…</ParaProvider>
</QueryClientProvider>

const { stellarSigner } = useParaStellarSigner({ networkPassphrase: NETWORK_PASSPHRASE });
stellarSigner.address                                   // G… address (StrKey, derived from the MPC ed25519 key)
await stellarSigner.signTransactionXDR(xdr, NETWORK_PASSPHRASE); // → signed XDR string
// also available: signTransaction (Wallet-Standard shape → { signedTxXdr, signerAddress }),
// signAuthEntry, signBytes — all on ParaStellarSigner from @getpara/stellar-sdk-v14-integration
```

Payment flow (gallery-standard classic path): `buildPaymentXdr` (shared) →
`stellarSigner.signTransactionXDR(xdr, NETWORK_PASSPHRASE)` →
`submitSignedXdr` (shared). Under the hood the signer hashes the tx, has Para's
MPC network co-sign the ed25519 signature (`para.signMessage` with a canonical
transaction context), and attaches it with `addSignature`.

## Credentials

- `VITE_PARA_API_KEY` — free at https://developer.getpara.com (sign up → create
  a project → copy the API key). A free developer key is a **BETA** key
  (`BETA_…` prefix); `PROD_…` keys are for production traffic.
- `VITE_PARA_ENVIRONMENT` — optional, defaults to `BETA`. Modern keys encode
  the environment in their prefix; only legacy keys strictly need `env` passed
  to `paraClientConfig` (this app always passes it, which is harmless).
- With no env at all the app still builds and renders: it shows
  `NeedsKeyBanner` instead of mounting `ParaProvider`.

## Caveats

- **Stellar wallet creation**: wallet types are enabled per project in the
  developer portal. If Stellar is enabled there, the modal auto-creates the
  STELLAR wallet at signup. If not, this app creates one client-side after
  login via `useCreateWallet` → `createWalletAsync({ type: "STELLAR" })`
  (`"STELLAR"` is first-class in `WALLET_TYPES` as of 3.14.0), then refetches
  the signer query. The portal docs page still lists only EVM/Solana/Cosmos in
  its network list — it lags the Aug 2026 Stellar launch; the client-side
  fallback covers a project where the toggle is missing.
- **Network passphrase default is PUBLIC**: `useParaStellarSigner` defaults to
  `Networks.PUBLIC`; the testnet passphrase must be passed both to the hook and
  to `signTransactionXDR`.
- **Peer-dependency graph**: `@getpara/react-sdk`'s main entry statically pulls
  its EVM/Cosmos/Solana/Sui modules, whose integrations peer-depend on
  `@cosmjs/*`, `@solana/*`, `@mysten/sui`, `graz`, `wagmi`, etc. This app only
  declares the react-sdk's own hard peers (`@tanstack/react-query`, `viem`) and
  relies on pnpm's default `auto-install-peers` for the transitive ones. If the
  central install runs with auto-install-peers disabled and the build fails to
  resolve those, fall back to Para's full documented install list (from
  v3/react/setup/vite): `@tanstack/react-query graz @cosmjs/cosmwasm-stargate
  @cosmjs/launchpad @cosmjs/proto-signing @cosmjs/stargate @cosmjs/tendermint-rpc
  @leapwallet/cosmos-social-login-capsule-provider long starknet wagmi@^2 viem
  @farcaster/mini-app-solana @farcaster/miniapp-sdk
  @farcaster/miniapp-wagmi-connector @solana-mobile/wallet-adapter-mobile
  @solana/wallet-adapter-base @solana/wallet-adapter-react
  @solana/wallet-adapter-walletconnect @solana/web3.js @stellar/stellar-sdk`.
- **Transaction review**: if the project has transaction review / 2FA policies
  enabled, `signMessage` can return a review URL instead of a signature; the
  signer then throws `TransactionReviewError`, which this app surfaces via
  `errorMessage`. Disable review policies in the portal for a smooth demo.
- **Docs naming drift**: docs pages mention `useStellarSigner` / `useParaStellar`;
  in 3.14.0 the exported hook is `useParaStellarSigner` (with a deprecated
  `useStellarSigner` alias). The shipped types are the authority here.
- The signer derives the G-address from the wallet's ed25519 key material
  (`deriveStellarAddress`); Para's own test helper notes Stellar reuses the
  Ed25519 (Solana-style) key infrastructure internally.
