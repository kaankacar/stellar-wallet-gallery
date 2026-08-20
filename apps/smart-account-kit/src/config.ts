/**
 * Smart Account Kit configuration.
 *
 * Every value has a public, documented testnet default, so the app runs with
 * no .env at all. The defaults come from the kit's Protocol 27 deployment
 * manifest (docs/deployments-protocol-27-2026-07-09.md in
 * github.com/stellar/smart-account-kit) and demo/.env.example.
 *
 * These are public testnet contract addresses / WASM hashes — not secrets.
 */
import { NETWORK_PASSPHRASE, RPC_URL } from "@gallery/shared";

const env = import.meta.env;

export const CONFIG = {
  rpcUrl: env.VITE_RPC_URL || RPC_URL,
  networkPassphrase: env.VITE_NETWORK_PASSPHRASE || NETWORK_PASSPHRASE,

  /** Smart account WASM hash (uploaded to testnet; each wallet deploys its own instance). */
  accountWasmHash:
    env.VITE_ACCOUNT_WASM_HASH ||
    "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",

  /** Deployed WebAuthn (secp256r1 passkey) verifier contract on testnet. */
  webauthnVerifierAddress:
    env.VITE_WEBAUTHN_VERIFIER_ADDRESS ||
    "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F",

  /** Native XLM Stellar Asset Contract (SAC) on testnet. */
  nativeTokenContract:
    env.VITE_NATIVE_TOKEN_CONTRACT ||
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",

  /**
   * OpenZeppelin Relayer proxy for fee sponsoring. `??` (not `||`) so an
   * explicit VITE_RELAYER_URL="" disables sponsoring — but note the kit's
   * shared default deployer is sign-only, so without a relayer both wallet
   * deployment and passkey transfers have no fee source and will fail.
   */
  relayerUrl:
    env.VITE_RELAYER_URL ??
    "https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev",
} as const;

export const DOCS_URL = "https://github.com/stellar/smart-account-kit";

/**
 * Vars whose resolved value is empty (only possible when explicitly blanked
 * in .env — with no env at all every default applies and this is empty).
 */
export const MISSING_VARS: string[] = [
  ["VITE_RPC_URL", CONFIG.rpcUrl],
  ["VITE_NETWORK_PASSPHRASE", CONFIG.networkPassphrase],
  ["VITE_ACCOUNT_WASM_HASH", CONFIG.accountWasmHash],
  ["VITE_WEBAUTHN_VERIFIER_ADDRESS", CONFIG.webauthnVerifierAddress],
  ["VITE_NATIVE_TOKEN_CONTRACT", CONFIG.nativeTokenContract],
  ["VITE_RELAYER_URL", CONFIG.relayerUrl],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);
