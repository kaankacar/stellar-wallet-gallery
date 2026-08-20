/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Channels-compatible relayer base URL. Default: OZ managed testnet endpoint. */
  readonly VITE_RELAYER_URL?: string;
  /** Relayer API key. Default: minted at runtime via the keyless testnet /gen endpoint. */
  readonly VITE_RELAYER_API_KEY?: string;
  /** Smart-wallet WASM hash override. Default: the canonical testnet v1 hash. */
  readonly VITE_WALLET_WASM_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
