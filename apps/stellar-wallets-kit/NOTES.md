# Stellar Wallets Kit — implementation notes

`@creit.tech/stellar-wallets-kit` pinned to **2.5.0** (npm). Port 5180.

## Doc sources actually used

- https://stellarwalletskit.dev (v2 docs site)
- Repo at the exact pinned tag `v2.5.0` (raw.githubusercontent.com/Creit-Tech/Stellar-Wallets-Kit/v2.5.0/…):
  - `README.md`
  - `docs/files/installation.md`, `docs/files/how-to/init.md`,
    `docs/files/how-to/authenticate.md`, `docs/files/how-to/get-wallet-address.md`,
    `docs/files/how-to/sign-with-wallet.md`, `docs/files/how-to/kit-events.md`,
    `docs/files/how-to/the-easy-way.md`
  - `docs/files/wallets/supported-wallets.md`, `ledger.md`, `trezor.md`, `wallet-connect.md`
  - Source of truth for signatures: `src/sdk/kit.ts`, `src/types/mod.ts`,
    `src/types/sdk.ts`, `src/sdk/modules/utils.ts`
- npm registry metadata + tarball for `@creit.tech/stellar-wallets-kit@2.5.0`
  (verified the subpath `exports` map and that `.d.ts` files ship next to the ESM build).

## v1 → v2: what changed (don't trust the old tutorials)

The official Stellar docs tutorial still shows the **v1** API
(`new StellarWalletsKit({ network, modules })` + `kit.openModal({ onWalletSelected })`).
**v2 removed all of that.** In 2.x, `StellarWalletsKit` is a **static class**:

- configure once with `StellarWalletsKit.init(params)` — no constructor;
- connect with `await StellarWalletsKit.authModal()` — no `openModal`/`onWalletSelected` callback;
- v1's `WalletNetwork` enum is now `Networks` (exported from `…/types`);
- docs moved to JSR under `@creit-tech/stellar-wallets-kit` (hyphen), but the
  **npm package `@creit.tech/stellar-wallets-kit` (dot) is still published with the
  identical code and subpath exports**, so the docs' import paths work verbatim
  after swapping the package name. Creit Tech says npm publishing will stop
  eventually — future upgrades should migrate to JSR.

## Exact v2.5.0 API surface used (all verified against tag source)

```ts
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger";
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";
import { KitEventType, Networks } from "@creit.tech/stellar-wallets-kit/types";

// One-time static init. IMPORTANT: the kit's internal default network is
// Networks.PUBLIC, so TESTNET must be passed explicitly.
StellarWalletsKit.init({
  network: Networks.TESTNET, // === "Test SDF Network ; September 2015"
  modules: [...defaultModules(), new LedgerModule(), new HotWalletModule()],
});

// Connect: opens the wallet-picker modal, resolves with the picked wallet's
// active address; rejects with {code:-1, message:"The user closed the modal."}.
const { address } = await StellarWalletsKit.authModal(); // Promise<{ address: string }>

// Reload persistence: the kit stores address + selected wallet in localStorage.
const { address } = await StellarWalletsKit.getAddress(); // throws if not connected

// Sign (SEP-43 shape):
const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
  networkPassphrase, // optional; falls back to the network set in init()
  address,           // optional
}); // Promise<{ signedTxXdr: string; signerAddress?: string }>

// Events (unsubscribe by calling the returned function):
const off = StellarWalletsKit.on(KitEventType.DISCONNECT, () => { /* … */ });

await StellarWalletsKit.disconnect(); // clears kit state + fires DISCONNECT
```

App flow: `buildPaymentXdr` (shared) → `StellarWalletsKit.signTransaction` →
`submitSignedXdr` (shared, Horizon testnet) → stellar.expert link.

## Wallet modules enabled

`defaultModules()` (v2.5.0): Albedo, Freighter, Fordefi, Rabet, xBull, Lobstr,
Hana, Klever, OneKey, Bitget, Cactus Link, D'CENT — plus manually added
`LedgerModule` and `HotWalletModule`.

Excluded on purpose (need real app credentials, against the "no credentials"
setup of this demo):

- **Trezor** — `new TrezorModule({ appUrl, appName, email })` required.
- **WalletConnect** — `new WalletConnectModule({ projectId, metadata })` required
  (Reown/WalletConnect Cloud project ID).

## Caveats

- **Extensions must be installed** for extension wallets to show as available:
  Freighter, xBull, Rabet, Lobstr, Hana, OneKey, Bitget are browser extensions.
  The modal's availability check gives each module 1s to answer; unavailable
  wallets show an "Install" label (kit default).
- **Wallet must itself be on Testnet.** We pass `networkPassphrase` when signing,
  but some wallets (kit docs call out Lobstr and Rabet) don't let the dApp choose
  the network — the user has to switch inside the wallet, or signing/submission
  fails with a bad-auth error.
- **HOT Wallet is mainnet-oriented**: its module ignores `networkPassphrase` and
  reports `Networks.PUBLIC` from `getNetwork()`; don't expect it to work on this
  testnet demo — included to show the modal wiring only.
- **Ledger/HOT need Node polyfills**: per the kit's own docs, `LedgerModule`
  breaks at import time without a global `Buffer`, and `HotWalletModule` needs
  `Buffer` + `global`. `src/polyfills.ts` (npm `buffer` package) is the first
  import of `src/kit.ts`, which guarantees evaluation order. Ledger additionally
  needs WebUSB (Chromium-based browsers) and the Stellar app open on the device.
- `StellarWalletsKit.on(KitEventType.STATE_UPDATED, …)` fires immediately on
  subscribe (signal-based). The app only listens to `DISCONNECT` and uses
  `getAddress()` for reload restore, which avoids the initial-fire ambiguity.
- The kit renders its modal UI itself (Preact + twind, bundled) — no CSS import
  is needed from the kit.
- `signAndSubmitTransaction` exists in 2.5.0 but only WalletConnect-based
  modules implement it — not used here; we submit through Horizon ourselves.
