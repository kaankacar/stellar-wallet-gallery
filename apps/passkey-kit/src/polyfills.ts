/**
 * Node-style globals required by passkey-kit's dependency chain
 * (base64url + stellar-sdk XDR work use `Buffer`; some transitive code
 * expects `global`). The upstream passkey-kit demo does exactly this in
 * its main.ts before anything else loads.
 *
 * This module MUST be evaluated before any passkey-kit import — see
 * src/main.tsx, where it is the first import.
 */
import { Buffer } from "buffer";

const g = globalThis as any;
if (!g.Buffer) g.Buffer = Buffer;
if (!g.global) g.global = globalThis;
