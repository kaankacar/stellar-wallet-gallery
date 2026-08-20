/**
 * Node-style globals required by two optional kit modules
 * (the kit's own docs call this out):
 *  - LedgerModule needs a global `Buffer` (docs/files/wallets/ledger.md)
 *  - HotWalletModule needs global `Buffer` and `global`
 *    (comment on the HotWalletModule class in v2.5.0 source)
 *
 * This module MUST be evaluated before any kit module is imported —
 * see src/kit.ts, where it is the first import.
 */
import { Buffer } from "buffer";

const g = globalThis as any;
if (!g.Buffer) g.Buffer = Buffer;
if (!g.global) g.global = globalThis;
