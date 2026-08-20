import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";

export const explorerTxUrl = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerAccountUrl = (address: string) =>
  `https://stellar.expert/explorer/testnet/${address.startsWith("C") ? "contract" : "account"}/${address}`;

const horizon = new Horizon.Server(HORIZON_URL);

/**
 * XLM balance for a G-account (Horizon) or C-address contract wallet
 * (native SAC balance via RPC). Returns null when the account/balance
 * does not exist yet.
 */
export async function getXlmBalance(address: string): Promise<string | null> {
  if (address.startsWith("C")) {
    const server = new rpc.Server(RPC_URL);
    const res = await server.getSACBalance(address, Asset.native(), NETWORK_PASSPHRASE);
    if (!res.balanceEntry) return null;
    return (Number(res.balanceEntry.amount) / 1e7).toFixed(7);
  }
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? native.balance : null;
  } catch {
    return null;
  }
}

/** Fund a testnet address (G or C) via friendbot. */
export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Friendbot failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

/**
 * Build an unsigned classic payment transaction XDR from a funded
 * G-account. Contract-wallet apps (passkey/smart-account) build their
 * own native SAC transfer instead of using this.
 */
export async function buildPaymentXdr(opts: {
  source: string;
  destination: string;
  amount: string;
}): Promise<string> {
  const account = await horizon.loadAccount(opts.source);
  const tx = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * 10).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: opts.destination,
        asset: Asset.native(),
        amount: opts.amount,
      }),
    )
    .setTimeout(180)
    .build();
  return tx.toXDR();
}

/** Submit a signed transaction XDR to Horizon testnet. */
export async function submitSignedXdr(signedXdr: string): Promise<{ hash: string }> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const res = await horizon.submitTransaction(tx);
  return { hash: res.hash };
}

/** Compact error message from Horizon/RPC/kit errors for UI display. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const anyE = e as any;
    const codes = anyE?.response?.data?.extras?.result_codes;
    if (codes) return `Transaction failed: ${JSON.stringify(codes)}`;
    if (typeof anyE.message === "string") return anyE.message;
  }
  return String(e);
}
