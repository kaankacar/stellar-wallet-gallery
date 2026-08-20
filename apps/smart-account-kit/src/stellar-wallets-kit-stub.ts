/**
 * Inert stand-in for "@creit-tech/stellar-wallets-kit" (the JSR package).
 *
 * smart-account-kit's optional StellarWalletsKitAdapter lazily
 * `await import()`s that package for delegated external-wallet signers.
 * This demo never constructs the adapter, so the import never runs at
 * runtime — this stub only exists so Vite/Rollup can resolve the specifier
 * at build time (see resolve.alias in vite.config.ts).
 */
export class StellarWalletsKit {
  constructor() {
    throw new Error(
      "@creit-tech/stellar-wallets-kit is not installed in this demo",
    );
  }
}
export const sep43Modules = [] as unknown[];
export default {};
