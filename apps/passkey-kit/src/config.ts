/**
 * Public configuration + kit singletons. Everything here is browser-safe:
 * this app bundles NO secrets (see src/relayer.ts for the keyless
 * fee-sponsored submission path).
 */
import { NETWORK_PASSPHRASE, RPC_URL } from "@gallery/shared";
import { Asset } from "@stellar/stellar-sdk";
import { MercuryIndexer, PasskeyKit, SACClient } from "passkey-kit";
import { LocalStorageAdapter } from "passkey-kit/storage";

const env = import.meta.env;

/**
 * Canonical v1 smart-wallet WASM hash on testnet, pinned from the repo's
 * hash manifest `docs/deployments-testnet-2026-07-11.md` (re-pinned
 * 2026-07-13) — the same value the upstream demo pins in .env.production.
 */
export const WALLET_WASM_HASH: string =
  env.VITE_WALLET_WASM_HASH?.trim() ||
  "fdefad64b96837147e1c333e51f537b696eab925e9f147e63d597c04e3c903f0";

/**
 * OpenZeppelin Relayer "Channels" endpoint used for fee-sponsored submission
 * (passkey-kit >= 0.16 replaced Launchtube with OZ Channels). The managed
 * testnet endpoint is keyless: API keys are minted at runtime via GET /gen.
 */
export const RELAYER_URL: string =
  env.VITE_RELAYER_URL?.trim() || "https://channels.openzeppelin.com/testnet";

/** Optional pre-provisioned relayer API key; minted at runtime when unset. */
export const RELAYER_API_KEY: string | undefined =
  env.VITE_RELAYER_API_KEY?.trim() || undefined;

/**
 * Native XLM Stellar Asset Contract id on testnet, derived deterministically
 * from the network passphrase (equals the id the upstream demo pins:
 * CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC).
 */
export const NATIVE_SAC_ID: string = Asset.native().contractId(NETWORK_PASSPHRASE);

/**
 * Passkey-record persistence (keyId → contractId) in localStorage via the
 * kit's own storage adapter, so "reconnect" works across reloads without a
 * WebAuthn discovery ceremony.
 */
export const storage = new LocalStorageAdapter();

/** The browser-side kit: passkey ceremonies, wallet lifecycle, signing. */
export const kit = new PasskeyKit({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  walletWasmHash: WALLET_WASM_HASH,
  storage,
});

/** SEP-41 client factory for the native XLM SAC transfer. */
export const sac = new SACClient({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
});

export const nativeToken = sac.getSACClient(NATIVE_SAC_ID);

/**
 * Mercury's hosted, keyless passkey-indexer — used as the keyId → contractId
 * reverse-lookup fallback in connectWallet when local storage has no record
 * (e.g. connecting an existing wallet from a fresh browser).
 */
export const indexer = MercuryIndexer.forNetwork({ rpc: kit.rpc }, NETWORK_PASSPHRASE);
