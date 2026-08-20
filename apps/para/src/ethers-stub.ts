/**
 * Inert stand-in for "ethers".
 *
 * Para's react SDK lazily `import("ethers")`s inside its wagmi/EVM signer
 * enhancer paths (@getpara/react-sdk-lite useWagmiEthersEnhancer,
 * @getpara/react-core evm/ethers mutations). This Stellar-only app never
 * exercises those paths and does not install ethers — this stub exists so
 * Vite's dev prebundler and the production Rollup build can resolve the
 * specifier (see resolve.alias in vite.config.ts). Both call sites are
 * dynamic imports that destructure at runtime, so they would only fail if
 * actually executed.
 */
export class BrowserProvider {
  constructor() {
    throw new Error("ethers is not installed in this Stellar-only demo");
  }
}
export default {};
