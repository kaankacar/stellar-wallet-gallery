# Stellar Wallet Gallery

The **same tiny app, built six times — once per wallet kit** — for a side-by-side
comparison at the Stellar Developers Meeting. Every app has the identical flow and
identical UI (from `packages/shared`):

> connect / log in → show address + XLM balance → fund via friendbot → send an XLM
> payment → stellar.expert link

**Testnet only.** No secrets anywhere in this repo.

**Live demo:** <https://kaankacar.github.io/stellar-wallet-gallery/> — one URL,
six tabs (deployed from `main` by `.github/workflows/pages.yml`; the key-gated
apps read their dashboard credentials from repo Actions secrets at build time).

## The lineup

| App | Kit (pinned) | Wallet model | Auth UX | Credentials needed | Port |
| --- | --- | --- | --- | --- | --- |
| `apps/stellar-wallets-kit` | `@creit.tech/stellar-wallets-kit` 2.5.0 | Classic G-account, user's own wallet | Modal: Freighter, xBull, Albedo, Rabet, Ledger, Lobstr, HOT… | **None** | 5180 |
| `apps/blux` | `@bluxcc/react` 0.2.18 | Classic G-account | Modal: wallet, email, phone, OAuth | `VITE_BLUX_APP_ID` — [dashboard.blux.cc](https://dashboard.blux.cc) | 5181 |
| `apps/privy` | `@privy-io/react-auth` 3.37.1 | Embedded ed25519 G-account (tier-2 extended chain) | Email / social login | `VITE_PRIVY_APP_ID` — [dashboard.privy.io](https://dashboard.privy.io) (allow origin `http://localhost:5182`) | 5182 |
| `apps/para` | `@getpara/react-sdk` 3.14.0 + `@getpara/stellar-sdk-v14-integration` | Embedded MPC G-account | Email / social login | `VITE_PARA_API_KEY` — [developer.getpara.com](https://developer.getpara.com) (BETA key) | 5183 |
| `apps/passkey-kit` | `passkey-kit` 0.16.2 | Soroban smart wallet (C-address) | WebAuthn passkey (Face ID / Touch ID) | **None** (deploys sponsored via OZ Channels; transfers via direct RPC¹) | 5184 |
| `apps/smart-account-kit` | `smart-account-kit` 0.6.0 | OpenZeppelin smart account (C-address) | WebAuthn passkey | **None** (SDF public testnet relayer proxy sponsors fees) | 5185 |

Three of six run with **zero setup**: Stellar Wallets Kit, Passkey Kit, and Smart
Account Kit. Blux, Privy, and Para need a free dashboard credential each — grab
them before demo day and drop them in each app's `.env` (see `.env.example`).

¹ The hosted OZ Channels testnet relayer can't yet parse the Protocol 27
V2 credentials passkey-kit signs with (verified live 2026-08-18, details in
`apps/passkey-kit/NOTES.md`), so transfers submit via direct RPC with a
throwaway friendbot-funded fee source instead — still zero credentials.

## Verified end-to-end (headless, 2026-08-18)

- **Shared payment plumbing** (the build → sign → submit path all four
  classic-account apps use): live testnet tx
  [`94dd1cd2…`](https://stellar.expert/explorer/testnet/tx/94dd1cd269a8e82daa28548ef666d4122db9121a503a851e2a08f919c5a76fb9),
  via `packages/shared/scripts/verify-shared.ts`.
- **Smart Account Kit**: full browser E2E with a virtual WebAuthn
  authenticator — create → fund → transfer, tx
  [`bced5a26…`](https://stellar.expert/explorer/testnet/tx/bced5a26912be1c24e1df6c05c2ed399d2a7dbbdac972d1c9ed66e4e1950fe4d)
  confirmed on Horizon.
- **Passkey Kit**: full browser E2E likewise — create (sponsored deploy via
  OZ Channels) → fund → transfer, tx
  [`2b5eaf21…`](https://stellar.expert/explorer/testnet/tx/2b5eaf21eb165d205d71dcd06b3ba2e05337533f9dfc82305922c0db10aed425)
  confirmed on Horizon.
- **SWK / Blux / Privy / Para**: verified to build and render; their live
  signing ceremonies need a real wallet extension or a dashboard credential,
  so dry-run those in a browser before demo day.

## Run it

```sh
pnpm install

pnpm dev:swk            # 5180 — Stellar Wallets Kit
pnpm dev:blux           # 5181 — Blux
pnpm dev:privy          # 5182 — Privy
pnpm dev:para           # 5183 — Para
pnpm dev:passkey        # 5184 — Passkey Kit
pnpm dev:smart-account  # 5185 — Smart Account Kit

pnpm build              # builds all six
```

## What to look at

The point of the gallery is the diff. Every `apps/*/src/App.tsx` is the same
skeleton; what changes between kits is exactly the interesting part:

- **How you connect** — extension modal (SWK) vs. auth modal (Blux) vs. embedded
  login (Privy/Para) vs. passkey ceremony (passkey-kit/smart-account-kit).
- **Who holds the key** — the user's wallet, an embedded/MPC provider, or a
  device passkey controlling an on-chain contract.
- **How you sign** — `signTransaction(xdr)` (SWK, Blux), raw ed25519 hash signing
  (Privy), an SDK signer (Para), or WebAuthn assertion over a Soroban auth entry
  (passkey-kit, smart-account-kit).
- **How you submit** — classic kits submit the signed XDR straight to Horizon
  (shared code path, kept identical on purpose); contract wallets submit through a
  fee-sponsoring relayer (OpenZeppelin Channels / SDF relayer proxy).

Each app's `NOTES.md` documents the exact API surface used, the doc sources it
was verified against, and its caveats.

## Repo layout

```
apps/<kit>/          six identical demos, one per kit (see table)
packages/shared/     shared UI shell + testnet helpers (Horizon/RPC balance for
                     G- and C-addresses, friendbot, payment build/submit)
DESIGN.md            the contract every app follows
```

## Honorable mentions (kits not in the gallery)

- **Official Wallet SDK** (TS/Kotlin/Flutter/Swift) — for building full wallets
  with SEP-24 anchor flows; heavier than a connect kit.
- **Soropass** — minimal passkey SDK that plugs into Stellar Wallets Kit.
- **JS-Capacitor Passkey Kit** — native passkeys for iOS/Android hybrid apps.
- **Pollar** — Stellar-native onboarding/wallet-activation SDK.
- **Walletban** — walletless onboarding SDK.
- **HOT Connector kit** — HOT Labs' connector (mainnet-oriented).

## Demo-day notes

- Passkey apps need a WebAuthn-capable browser; `localhost` counts as a secure
  context, so no HTTPS needed for local demos.
- Extension wallets (Freighter, xBull, …) must be installed, unlocked, and
  switched to **Testnet** manually.
- Friendbot funds both G-addresses and C-address smart wallets on testnet.
