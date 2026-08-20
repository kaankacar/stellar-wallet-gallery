/**
 * On-chain verification of the Soroswap swap path used by the SwapCard:
 * friendbot fund → /quote → /quote/build → local Keypair sign (stand-in for
 * the kit signer) → Horizon submit → USDC token-balance delta check.
 *
 * Run from packages/shared:  SOROSWAP_API_KEY=sk_… pnpm dlx tsx scripts/verify-swap.mts
 */
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  explorerTxUrl,
  fundWithFriendbot,
  getTokenBalance,
  submitSignedXdr,
} from "../src/stellar";

const API = "https://api.soroswap.finance";
const KEY = process.env.SOROSWAP_API_KEY;
const XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const USDC = "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F";

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}?network=testnet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function main() {
  if (!KEY) throw new Error("SOROSWAP_API_KEY not set");
  const kp = Keypair.random();
  console.log("wallet:", kp.publicKey());
  await fundWithFriendbot(kp.publicKey());

  const usdcBefore = await getTokenBalance(USDC, kp.publicKey());
  console.log("USDC before:", usdcBefore);

  const quote = await post("/quote", {
    assetIn: XLM,
    assetOut: USDC,
    amount: 100_000_000, // 10 XLM in stroops
    tradeType: "EXACT_IN",
    protocols: ["soroswap"],
    slippageBps: 100,
  });
  console.log("QUOTE SHAPE:", JSON.stringify(quote).slice(0, 1200));

  const built = await post("/quote/build", {
    quote,
    from: kp.publicKey(),
    to: kp.publicKey(),
  });
  if (typeof built?.xdr !== "string") throw new Error(`build returned: ${JSON.stringify(built).slice(0, 300)}`);

  const tx = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE);
  tx.sign(kp); // ← the step each wallet kit performs in-app
  const { hash } = await submitSignedXdr(tx.toXDR());
  console.log("swap tx:", explorerTxUrl(hash));

  const usdcAfter = await getTokenBalance(USDC, kp.publicKey());
  console.log("USDC after:", usdcAfter);
  if (!usdcAfter || Number(usdcAfter) <= Number(usdcBefore ?? 0)) {
    throw new Error("USDC balance did not increase");
  }
  console.log("OK: Soroswap swap path verified end-to-end on testnet ✓");
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
