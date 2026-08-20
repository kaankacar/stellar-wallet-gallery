/**
 * On-chain verification of the shared testnet helpers — the exact path every
 * classic-account app (SWK, Blux, Privy, Para) uses, with a local Keypair
 * standing in for the kit's signer:
 *
 *   friendbot fund → getXlmBalance → buildPaymentXdr → sign → submitSignedXdr
 *   → balance delta check
 *
 * Run: pnpm dlx tsx scripts/verify-shared.ts   (from packages/shared)
 */
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  buildPaymentXdr,
  explorerTxUrl,
  fundWithFriendbot,
  getXlmBalance,
  submitSignedXdr,
} from "../src/stellar";

async function main() {
  const sender = Keypair.random();
  const receiver = Keypair.random();
  console.log("sender  ", sender.publicKey());
  console.log("receiver", receiver.publicKey());

  console.log("funding both via friendbot…");
  await Promise.all([
    fundWithFriendbot(sender.publicKey()),
    fundWithFriendbot(receiver.publicKey()),
  ]);

  const before = await getXlmBalance(receiver.publicKey());
  if (before === null) throw new Error("receiver unfunded after friendbot");
  console.log("receiver balance before:", before);

  const xdr = await buildPaymentXdr({
    source: sender.publicKey(),
    destination: receiver.publicKey(),
    amount: "1",
  });
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  tx.sign(sender); // ← the step each kit performs in-app
  const { hash } = await submitSignedXdr(tx.toXDR());
  console.log("submitted:", explorerTxUrl(hash));

  const after = await getXlmBalance(receiver.publicKey());
  console.log("receiver balance after: ", after);
  const delta = Number(after) - Number(before);
  if (Math.abs(delta - 1) > 1e-7) {
    throw new Error(`balance delta ${delta}, expected 1`);
  }
  console.log("OK: shared plumbing verified end-to-end on testnet ✓");
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
