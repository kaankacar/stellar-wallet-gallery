import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
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

const SIM_SOURCE_CACHE = "gallery:sim-source-secret";

/**
 * A funded classic account usable as a READ-ONLY simulation source when the
 * caller's own account does not exist on-chain yet (fresh embedded wallets
 * before friendbot). Browser-only fallback: a throwaway keypair, friendbot-
 * funded once, cached in localStorage — it never signs anything user-facing.
 */
export async function getSimulationAccount(server: rpc.Server, preferred: string) {
  if (preferred.startsWith("G")) {
    try {
      return await server.getAccount(preferred);
    } catch {
      /* unfunded — fall through to the shared sim source */
    }
  }
  if (typeof localStorage === "undefined") {
    throw new Error(`Account not found: ${preferred}`);
  }
  const cached = localStorage.getItem(SIM_SOURCE_CACHE);
  const kp = cached ? Keypair.fromSecret(cached) : Keypair.random();
  if (!cached) localStorage.setItem(SIM_SOURCE_CACHE, kp.secret());
  try {
    return await server.getAccount(kp.publicKey());
  } catch {
    await fundWithFriendbot(kp.publicKey());
    return await server.getAccount(kp.publicKey());
  }
}

/**
 * Balance of a Soroban token (SEP-41 `balance(id)`) for any holder, read via
 * RPC simulation — covers pure Soroban tokens that never appear in Horizon
 * balances. Returns "0.0000000"-style strings; null when unreadable.
 */
export async function getTokenBalance(
  tokenContract: string,
  holder: string,
): Promise<string | null> {
  try {
    const server = new rpc.Server(RPC_URL);
    const account = await getSimulationAccount(server, holder);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(tokenContract).call("balance", Address.fromString(holder).toScVal()),
      )
      .setTimeout(60)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
      const v = scValToNative(sim.result.retval) as bigint;
      return (Number(v) / 1e7).toFixed(7);
    }
    return null;
  } catch {
    return null;
  }
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
