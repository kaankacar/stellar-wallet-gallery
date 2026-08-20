/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_ACCOUNT_WASM_HASH?: string;
  readonly VITE_WEBAUTHN_VERIFIER_ADDRESS?: string;
  readonly VITE_NATIVE_TOKEN_CONTRACT?: string;
  readonly VITE_RELAYER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
