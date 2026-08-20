# Stellar Wallet Gallery — design contract

The same tiny app, implemented once per wallet kit, for a side-by-side demo at the
Stellar Developers Meeting. **Testnet only.**

## Layout

```
apps/
  stellar-wallets-kit/   port 5180  @creit.tech/stellar-wallets-kit@2.5.0
  blux/                  port 5181  @bluxcc/react@0.2.18
  privy/                 port 5182  @privy-io/react-auth@3.37.1
  para/                  port 5183  @getpara/react-sdk@3.14.0
  passkey-kit/           port 5184  passkey-kit@0.16.2
  smart-account-kit/     port 5185  smart-account-kit@0.6.0
packages/
  shared/                @gallery/shared — common UI + testnet helpers (consumed as TS source)
```

## The standard app (identical in every implementation)

Single page, three states:

1. **Connect** — a `Card` with the kit's connect/login flow (kit-specific: modal,
   embedded login, passkey creation, …).
2. **Account** — `AccountCard` with the address, XLM balance, refresh, and a
   friendbot fund button (testnet friendbot funds both G and C addresses).
3. **Send** — `PaymentCard`: destination + amount → build tx → **sign with the kit**
   → submit → stellar.expert link.

Classic-account kits use `buildPaymentXdr` + kit signing + `submitSignedXdr` from
`@gallery/shared`. Contract-wallet kits (passkey-kit, smart-account-kit) build a
native SAC transfer through their own kit APIs instead; submission may go through
the kit's channel (e.g. Launchtube) — document it.

Every app renders `DemoShell` with the kit name, a one-sentence tagline saying what
the kit is, and a distinct `accent` color.

## Shared API (`@gallery/shared`)

- `NETWORK_PASSPHRASE`, `HORIZON_URL`, `RPC_URL`, `explorerTxUrl`, `explorerAccountUrl`
- `getXlmBalance(address)` — G via Horizon, C via RPC SAC balance; `null` = unfunded
- `fundWithFriendbot(address)`
- `buildPaymentXdr({ source, destination, amount })` → unsigned XDR (classic payment)
- `submitSignedXdr(signedXdr)` → `{ hash }`
- `errorMessage(e)` — compact error for UI
- UI: `DemoShell`, `Card`, `Button`, `Field`, `AddressChip`, `AccountCard`,
  `PaymentCard`, `NeedsKeyBanner`, `StatusNote`
- Import styles once in `main.tsx`: `import "@gallery/shared/styles.css";`

## Rules for every app

- Vite + React + TypeScript. Exact shared toolchain:
  - `react` `18.3.1`, `react-dom` `18.3.1`
  - `vite` `^6.3.5`, `@vitejs/plugin-react` `^4.3.4`, `typescript` `^5.6.3`
  - `@types/react` `^18.3.12`, `@types/react-dom` `^18.3.1`
  - `@gallery/shared` `workspace:*`; add `@stellar/stellar-sdk` `^16.2.0` only if
    imported directly
- Pin the kit package to the version listed in the layout table above.
- `package.json` name `app-<dir>`; scripts: `"dev": "vite --port <port>"`,
  `"build": "vite build"`, `"preview": "vite preview --port <port>"`.
- Credentials only via `import.meta.env.VITE_*`. Ship `.env.example`. When a var is
  missing, render `NeedsKeyBanner` — the app must still **build and render** with no
  env at all.
- The app must work against the kit's REAL, current API — read the kit's actual docs
  and README first; never guess method names.
- Write `NOTES.md` in the app dir: doc sources used (URLs), exact auth/signing flow,
  required credentials and where to get them, known caveats.
- Do not run `pnpm install` or builds — installs happen centrally at the repo root.

## tsconfig template (per app)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

## index.html template (per app)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wallet Gallery — <KIT NAME></title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
