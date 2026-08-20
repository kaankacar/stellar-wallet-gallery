/**
 * On-chain verification of the DIRECT-ROUTER swap path used by the SwapCard:
 * friendbot fund → simulate router_get_amounts_out (quote) → build
 * swap_exact_tokens_for_tokens → local Keypair sign (stand-in for the kit
 * signer) → Horizon submit → USDC token-balance delta check.
 */
import { Address, BASE_FEE, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, RPC_URL, explorerTxUrl, fundWithFriendbot, getTokenBalance, submitSignedXdr } from "../src/stellar";

const ROUTER = "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";
const XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const USDC = "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F";
const path = () => xdr.ScVal.scvVec([Address.fromString(XLM).toScVal(), Address.fromString(USDC).toScVal()]);

async function main() {
  const server = new rpc.Server(RPC_URL);
  const kp = Keypair.random();
  console.log("wallet:", kp.publicKey());
  await fundWithFriendbot(kp.publicKey());
  console.log("USDC before:", await getTokenBalance(USDC, kp.publicKey()));

  const stroopsIn = 10n * 10_000_000n;
  const acct = await server.getAccount(kp.publicKey());
  const qtx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(ROUTER).call("router_get_amounts_out", nativeToScVal(stroopsIn, { type: "i128" }), path()))
    .setTimeout(60).build();
  const qsim = await server.simulateTransaction(qtx);
  if (!rpc.Api.isSimulationSuccess(qsim) || !qsim.result) throw new Error("quote sim failed: " + JSON.stringify(qsim).slice(0, 300));
  const amounts = scValToNative(qsim.result.retval) as bigint[];
  const out = amounts[amounts.length - 1];
  console.log("quote: 10 XLM →", (Number(out) / 1e7).toFixed(4), "USDC");

  const acct2 = await server.getAccount(kp.publicKey());
  const stx = new TransactionBuilder(acct2, { fee: (Number(BASE_FEE) * 10000).toString(), networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(ROUTER).call("swap_exact_tokens_for_tokens",
      nativeToScVal(stroopsIn, { type: "i128" }),
      nativeToScVal((out * 99n) / 100n, { type: "i128" }),
      path(),
      Address.fromString(kp.publicKey()).toScVal(),
      nativeToScVal(BigInt(Math.floor(Date.now() / 1000) + 600), { type: "u64" }),
    )).setTimeout(300).build();
  const prepared = await server.prepareTransaction(stx);
  const asXdr = prepared.toXDR(); // ← what SwapCard hands to the kit signer
  const tx = TransactionBuilder.fromXDR(asXdr, NETWORK_PASSPHRASE);
  tx.sign(kp); // ← the kit-signing step
  const { hash } = await submitSignedXdr(tx.toXDR());
  console.log("swap tx:", explorerTxUrl(hash));

  const after = await getTokenBalance(USDC, kp.publicKey());
  console.log("USDC after:", after);
  if (!after || Number(after) <= 0) throw new Error("USDC balance did not increase");
  console.log("OK: direct-router swap path verified end-to-end on testnet ✓");
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
