/**
 * Privy's raw-sign API for extended chains returns the ed25519 signature as a
 * hex string (`0x`-prefixed — see the `SignRawHashOutput` type in
 * `@privy-io/react-auth/extended-chains`), while stellar-sdk's
 * `Transaction.addSignature(publicKey, signature)` expects the signature as a
 * base64 string.
 */
export function hexToBase64(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error(`Not a valid hex string: ${hex.slice(0, 20)}…`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
