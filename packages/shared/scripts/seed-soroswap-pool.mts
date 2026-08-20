/**
 * Seed the Soroswap TESTNET XLM/USDC pool so the gallery's swap demo has
 * liquidity: friendbot-fund an LP keypair → faucet-mint test USDC →
 * /liquidity/add → sign → submit → verify the pool exists.
 *
 * Run from packages/shared:  SOROSWAP_API_KEY=… pnpm dlx tsx scripts/seed-soroswap-pool.mts
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

async function post(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}${path.includes("?") ? "&" : "?"}network=testnet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  if (!KEY) throw new Error("SOROSWAP_API_KEY not set");
  const lp = Keypair.random();
  console.log("LP wallet:", lp.publicKey());
  await fundWithFriendbot(lp.publicKey());

  console.log("faucet-minting USDC…");
  const faucet = await post(`/api/faucet?address=${lp.publicKey()}&contract=${USDC}`);
  console.log("faucet response:", JSON.stringify(faucet).slice(0, 300));

  const usdcBal = await getTokenBalance(USDC, lp.publicKey());
  console.log("LP USDC balance:", usdcBal);
  const usdc = Number(usdcBal ?? 0);
  if (usdc <= 0) throw new Error("faucet minted no USDC");

  // Pair at ~0.4 USDC per XLM; cap by what we hold (10k XLM minus fees/reserve).
  const usdcSide = Math.min(usdc, 2000);
  const xlmSide = Math.min(usdcSide / 0.4, 9000);
  const amountA = Math.round(xlmSide * 1e7);
  const amountB = Math.round(usdcSide * 1e7);
  console.log(`adding liquidity: ${xlmSide} XLM + ${usdcSide} USDC`);

  // Soroswap pairs are address-sorted (token0 < token1); USDC's CB… sorts
  // before XLM's CD…, so try the sorted order first, then the reverse.
  let add: any;
  const attempts = [
    { assetA: USDC, assetB: XLM, amountA: amountB, amountB: amountA },
    { assetA: XLM, assetB: USDC, amountA, amountB },
  ];
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      add = await post("/liquidity/add", {
        ...attempt,
        to: lp.publicKey(),
        slippageBps: "500",
      });
      console.log("liquidity/add ok with order:", attempt.assetA.slice(0, 6), "/", attempt.assetB.slice(0, 6));
      break;
    } catch (e) {
      lastErr = e;
      console.log("attempt failed:", String((e as Error).message).slice(0, 160));
    }
  }
  if (!add) throw lastErr;
  console.log("liquidity/add keys:", Object.keys(add));
  if (typeof add?.xdr !== "string") {
    throw new Error(`no xdr in response: ${JSON.stringify(add).slice(0, 300)}`);
  }
  const tx = TransactionBuilder.fromXDR(add.xdr, NETWORK_PASSPHRASE);
  tx.sign(lp);
  const { hash } = await submitSignedXdr(tx.toXDR());
  console.log("liquidity tx:", explorerTxUrl(hash));

  const pools = (await fetch(`${API}/pools?network=testnet&protocol=soroswap`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }).then((r) => r.json())) as any[];
  console.log("pools now:", pools.length);
  for (const p of pools) {
    console.log(
      `  ${p.tokenA?.slice(0, 6)}…/${p.tokenB?.slice(0, 6)}…`,
      Number(p.reserveA ?? 0) / 1e7,
      "/",
      Number(p.reserveB ?? 0) / 1e7,
    );
  }
  console.log("OK: pool seeded ✓");
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
