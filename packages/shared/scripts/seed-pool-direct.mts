/**
 * Seed the Soroswap TESTNET XLM/USDC pool by invoking the router's
 * add_liquidity directly (bypasses the API's opaque builder; RPC simulation
 * surfaces the real revert reason if any).
 *
 * Run from packages/shared:  SOROSWAP_API_KEY=… pnpm dlx tsx scripts/seed-pool-direct.mts
 */
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  explorerTxUrl,
  fundWithFriendbot,
  getTokenBalance,
} from "../src/stellar";

const KEY = process.env.SOROSWAP_API_KEY;
const ROUTER = "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";
const XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const USDC = "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F";

async function main() {
  const server = new rpc.Server(RPC_URL);
  const lp = Keypair.random();
  console.log("LP:", lp.publicKey());
  await fundWithFriendbot(lp.publicKey());

  // Faucet-mint USDC (public API endpoint, needs the key)
  const f = await fetch(
    `https://api.soroswap.finance/api/faucet?address=${lp.publicKey()}&contract=${USDC}&network=testnet`,
    { method: "POST", headers: { Authorization: `Bearer ${KEY}` } },
  );
  if (!f.ok) throw new Error(`faucet ${f.status}: ${(await f.text()).slice(0, 200)}`);
  console.log("USDC minted:", await getTokenBalance(USDC, lp.publicKey()));

  const xlmAmt = 5000n * 10_000_000n;
  const usdcAmt = 2000n * 10_000_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  const account = await server.getAccount(lp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * 10000).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(ROUTER).call(
        "add_liquidity",
        Address.fromString(XLM).toScVal(),
        Address.fromString(USDC).toScVal(),
        nativeToScVal(xlmAmt, { type: "i128" }),
        nativeToScVal(usdcAmt, { type: "i128" }),
        nativeToScVal(0n, { type: "i128" }),
        nativeToScVal(0n, { type: "i128" }),
        Address.fromString(lp.publicKey()).toScVal(),
        nativeToScVal(deadline, { type: "u64" }),
      ),
    )
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.error("SIMULATION ERROR:", JSON.stringify(sim, null, 2).slice(0, 1500));
    process.exit(1);
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(lp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`send failed: ${JSON.stringify(sent.errorResult).slice(0, 300)}`);
  }
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  console.log("status:", final.status, explorerTxUrl(sent.hash));
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) process.exit(1);
  console.log("OK: pool seeded via direct router call ✓");
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
