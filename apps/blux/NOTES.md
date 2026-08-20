# Blux (`@bluxcc/react@0.2.18`) — implementation notes

## Sources actually used

- Shipped type definitions of `@bluxcc/react@0.2.18` and `@bluxcc/core@0.2.18`
  (extracted from the npm tarballs — the ground truth for this pinned version:
  `dist/hooks/useBlux.d.ts`, `dist/Provider.d.ts`, core `dist/types.d.ts`,
  `dist/exports/blux.d.ts`, `dist/exports/createConfig.d.ts`,
  `dist/constants/networkDetails.d.ts`, `dist/utils/appValidity.d.ts`).
- https://docs.blux.cc — overview + install.
- https://docs.blux.cc/getting-started — appId comes from https://dashboard.blux.cc.
- https://docs.blux.cc/react/usage/sign-transaction — `signTransaction(xdr)` resolves to the
  signed envelope as a base64 XDR string, without submitting.
- https://docs.blux.cc/react/usage/send-transaction — `sendTransaction(xdr)` signs *and*
  submits, resolving to `{ hash, returnValue(), raw }`.
- `npm view @bluxcc/react readme` — note: the npm README is stale (0.1-era feature list);
  the config shape it shows is still correct.

## API surface used

```tsx
import { BluxProvider, networks, useBlux } from "@bluxcc/react";

<BluxProvider config={{
  appId,                              // required — validated against the Blux API
  appName: "Stellar Wallet Gallery",
  networks: [networks.testnet],       // network *passphrases*; networks.testnet === shared NETWORK_PASSPHRASE
  defaultNetwork: networks.testnet,
  explorer: "stellarexpert",
  isPersistent: true,                 // keep the session across reloads (defaults to false)
  appearance: { accentColor: "#ffd84d" },
}}>

const blux = useBlux();
// blux.isReady, blux.isAuthenticated, blux.user?.address
await blux.login();                                        // opens the Blux modal, resolves IUser
const signed = await blux.signTransaction(xdr, { network: NETWORK_PASSPHRASE });
blux.logout();
```

Payment flow (gallery-standard classic path): `buildPaymentXdr` (shared) →
`blux.signTransaction(xdr)` → `submitSignedXdr` (shared). Blux also offers
`sendTransaction(xdr)` which signs **and** submits through its own modal and resolves
`{ hash, returnValue, raw }`; I deliberately used sign-only + shared submission so every
gallery app submits through the same Horizon path. `signTransaction` is *typed*
`Promise<unknown>` in 0.2.18 (docs say string), so the app guards with a runtime
`typeof signed !== "string"` check before submitting.

## Credentials

- `VITE_BLUX_APP_ID` **is required** (see `.env.example`). Sign in at
  https://dashboard.blux.cc, create an app, copy the id.
- It is not decorative: core's `createConfig` throws if `appId` is missing, and the SDK
  validates the id against the Blux API — `login`, `profile`, `fundMe` and every signing
  method call `assertAppIsValid()` and refuse to run with a known-invalid id.
- With no env, the app still builds and renders: the provider is simply not mounted and
  `NeedsKeyBanner` is shown instead (mounting `BluxProvider` with an empty appId would make
  `createConfig` throw inside the provider's mount effect).

## Dependency notes

- `@bluxcc/react` peers: `@bluxcc/core@^0.2.18`, `@stellar/stellar-sdk@^16.2.0`,
  `@tanstack/react-query@^5.90.11`, `react >= 17` (react 18.3.1 per DESIGN.md is fine —
  no React 19 requirement).
- `@bluxcc/core`'s ESM bundle externalizes its own **non-optional** peers
  (`@albedo-link/intent`, `@ledgerhq/hw-app-str`, `@lobstrco/signer-extension-api`,
  `@stellar/freighter-api`, `@walletconnect/core`, `@walletconnect/sign-client`,
  `qrcode.react`, `zustand`). They're declared explicitly in this app's `package.json`
  (at exactly the ranges core declares) so the install doesn't depend on pnpm's
  `auto-install-peers` setting.

## Caveats

- **License**: the Blux Team License forbids production use until 2028 without a custom
  license — fine for this meetup demo, not for shipping.
- `main.tsx` skips `<React.StrictMode>`: `BluxProvider` runs `createConfig()` in a mount
  effect with no cleanup, and StrictMode's dev double-mount would initialize the Blux UI
  host twice.
- `showWalletUIs` defaults to `true`, so Blux shows its own confirmation modal before the
  wallet's — expected during the demo.
- Blux's built-in `fundMe()` opens its on-ramp modal; the gallery uses the shared friendbot
  button instead, per the design contract.
- Wallet login works out of the box; email/passkey/social methods appear in the modal only
  if enabled for the app id in the Blux dashboard (`loginMethods` defaults to `['wallet']`).
- Untested corner: the core bundle contains a `Buffer.from(...)` call in the bundled
  HOT-wallet path; browsers have no `Buffer` global, so if the HOT wallet flow misbehaves
  in the demo, that's the likely reason. Freighter/xBull/Lobstr/Albedo paths don't touch it.
