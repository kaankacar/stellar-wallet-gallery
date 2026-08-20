// Polyfills must evaluate before the Ledger / HOT modules load (Buffer, global).
import "./polyfills";

// v2 API (verified against the v2.5.0 tag of Creit-Tech/Stellar-Wallets-Kit):
// the kit is a static class configured once via StellarWalletsKit.init(...).
// The npm package `@creit.tech/stellar-wallets-kit` ships the same subpath
// exports as the JSR package used in the docs (`/sdk`, `/types`, `/modules/*`).
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger";
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";
import { KitEventType, Networks } from "@creit.tech/stellar-wallets-kit/types";

// The kit defaults to Networks.PUBLIC, so TESTNET must be set explicitly.
// Networks.TESTNET === "Test SDF Network ; September 2015" (same string as
// NETWORK_PASSPHRASE in @gallery/shared).
StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: [
    // Albedo, Freighter, Fordefi, Rabet, xBull, Lobstr, Hana, Klever,
    // OneKey, Bitget, Cactus Link, D'CENT — every module that needs no config.
    ...defaultModules(),
    // Non-default modules that only need the Buffer/global polyfills above.
    new LedgerModule(),
    new HotWalletModule(),
    // Trezor and WalletConnect are deliberately left out: they require app
    // credentials (Trezor: appUrl/appName/email; WalletConnect: projectId).
  ],
});

export { StellarWalletsKit, KitEventType };
