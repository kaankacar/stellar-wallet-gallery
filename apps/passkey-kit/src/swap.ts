/**
 * Soroswap swap FROM the passkey smart wallet.
 *
 * The router pulls the input tokens from `to`, so simulation emits an auth
 * entry for the smart wallet (C-address). The passkey signs exactly that
 * entry (kit.signAuthEntry → WebAuthn prompt, P27 address-bound credentials),
 * and the invoke is submitted through the same throwaway-fee-source direct-RPC
 * lane as transfers — the hosted OZ Channels relayer would be the natural fee
 * payer, but it can't parse the kit's P27 V2 credentials yet (verified live
 * 2026-08-18; see NOTES.md).
 */
import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
  type Operation,
} from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  SOROSWAP_ROUTER,
  TESTNET_USDC,
  TESTNET_XLM,
  getSimulationAccount,
} from "@gallery/shared";
import { PasskeySigner } from "passkey-kit";
import { kit } from "./config";
import { submitInvoke } from "./relayer";

export async function swapWithPasskey(
  wallet: string,
  keyId: string | null,
  stroopsIn: bigint,
  minOut: bigint,
): Promise<{ hash: string }> {
  const server = new rpc.Server(RPC_URL);
  // Any funded account works as the SIMULATION source; the real fee payer is
  // the throwaway fee source inside submitInvoke.
  const account = await getSimulationAccount(server, wallet);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(SOROSWAP_ROUTER).call(
        "swap_exact_tokens_for_tokens",
        nativeToScVal(stroopsIn, { type: "i128" }),
        nativeToScVal(minOut, { type: "i128" }),
        xdr.ScVal.scvVec([
          Address.fromString(TESTNET_XLM).toScVal(),
          Address.fromString(TESTNET_USDC).toScVal(),
        ]),
        Address.fromString(wallet).toScVal(),
        nativeToScVal(deadline, { type: "u64" }),
      ),
    )
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const err = (sim as any)?.error ?? "unknown";
    throw new Error(`Swap simulation failed: ${String(err).slice(0, 180)}`);
  }

  // Sign the smart wallet's auth entries with the passkey (WebAuthn prompt).
  const entries = sim.result?.auth ?? [];
  const signed: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of entries) {
    const creds = entry.credentials();
    const isWallet =
      creds.switch().name === "sorobanCredentialsAddress" &&
      Address.fromScAddress(creds.address().address()).toString() === wallet;
    signed.push(
      isWallet ? await kit.signAuthEntry(entry, new PasskeySigner(keyId ?? undefined)) : entry,
    );
  }

  const func = (tx.operations[0] as Operation.InvokeHostFunction).func;
  return submitInvoke(func, signed);
}
