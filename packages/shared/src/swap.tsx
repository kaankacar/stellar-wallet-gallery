import { useCallback, useEffect, useState } from "react";
import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { Button, Card, Field } from "./ui";
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  errorMessage,
  explorerTxUrl,
  getSimulationAccount,
  getTokenBalance,
  submitSignedXdr,
} from "./stellar";

/**
 * Soroswap TESTNET contracts. Router/factory from the public registry
 * (api.soroswap.finance/api/testnet/router); token contracts from the public
 * /api/tokens list (2026-08-20). Testnet USDC is a PURE Soroban token
 * (name() = "USDCoin", verified via RPC) — not a classic-asset SAC — so
 * G-accounts receive it without a trustline. It is Soroswap's faucet-minted
 * test token, NOT Circle's USDC (Circle's testnet USDC is the classic asset
 * USDC:GBBD47IF…FLA5, SAC CBIELTK6…DAMA) — hence the "tUSDC" label in the UI.
 * The XLM/USDC pair was seeded
 * with liquidity for this gallery (5,000 XLM + 2,000 USDC, 2026-08-20).
 * Quarterly testnet resets wipe all of this; re-seed with
 * packages/shared/scripts/seed-pool-direct.mts.
 */
export const SOROSWAP_ROUTER = "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";
export const TESTNET_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const TESTNET_USDC = "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F";

const pathScVal = () =>
  xdr.ScVal.scvVec([
    Address.fromString(TESTNET_XLM).toScVal(),
    Address.fromString(TESTNET_USDC).toScVal(),
  ]);

/** Read-only quote via simulation of router_get_amounts_out (keyless). Works
 * even before the user's own account is funded — simulation falls back to a
 * shared throwaway source. */
async function quoteAmountOut(source: string, stroopsIn: bigint): Promise<bigint> {
  const server = new rpc.Server(RPC_URL);
  const account = await getSimulationAccount(server, source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(SOROSWAP_ROUTER).call(
        "router_get_amounts_out",
        nativeToScVal(stroopsIn, { type: "i128" }),
        pathScVal(),
      ),
    )
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    const err = (sim as any)?.error ?? "no route (pool missing or unfunded?)";
    throw new Error(`Quote simulation failed: ${String(err).slice(0, 160)}`);
  }
  const amounts = scValToNative(sim.result.retval) as bigint[];
  return amounts[amounts.length - 1];
}

/** Build a ready-to-sign swap_exact_tokens_for_tokens transaction XDR. */
async function buildSwapXdr(source: string, stroopsIn: bigint, minOut: bigint): Promise<string> {
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(source);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const tx = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * 10000).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(SOROSWAP_ROUTER).call(
        "swap_exact_tokens_for_tokens",
        nativeToScVal(stroopsIn, { type: "i128" }),
        nativeToScVal(minOut, { type: "i128" }),
        pathScVal(),
        Address.fromString(source).toScVal(),
        nativeToScVal(deadline, { type: "u64" }),
      ),
    )
    .setTimeout(300)
    .build();
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * XLM → USDC swap against the Soroswap AMM router on testnet, fully
 * client-side: quote by simulating router_get_amounts_out, build
 * swap_exact_tokens_for_tokens, sign with the host app's kit (`signXdr`),
 * submit via Horizon. No API key needed. Contract-wallet (C-address) apps
 * get an explanatory state instead — the tx source must be a classic account.
 */
export function SwapCard(props: {
  address: string;
  signXdr?: (xdr: string) => Promise<string>;
  /** Contract-wallet apps: perform the whole swap (build → authorize with the
   * wallet's signer → submit) given the quoted amounts. When provided, the
   * card is interactive even for C-addresses. */
  performSwap?: (stroopsIn: bigint, minOut: bigint) => Promise<{ hash: string }>;
  onSwapped?: () => void | Promise<void>;
  note?: string;
}) {
  const { address } = props;
  const isContract = address.startsWith("C");
  const [amount, setAmount] = useState("10");
  const [quote, setQuote] = useState<{ in: bigint; out: bigint } | null>(null);
  const [busy, setBusy] = useState<null | "quote" | "swap">(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usdc, setUsdc] = useState<string | null>(null);

  const refreshUsdc = useCallback(async () => {
    setUsdc(await getTokenBalance(TESTNET_USDC, address));
  }, [address]);

  useEffect(() => {
    void refreshUsdc();
  }, [refreshUsdc]);

  if (isContract && !props.performSwap) {
    return (
      <Card title="Swap on Soroswap (testnet)">
        <p className="muted small">
          This wallet is a smart contract (a C-address), and every Stellar
          transaction needs a classic G account as its fee-paying source — so
          this page's swap builder doesn't apply here. This kit's high-level
          SDK covers transfers; for a live smart-wallet swap see the Passkey
          Kit tab, where the router call is authorized by a passkey-signed
          entry and a throwaway fee source pays the fee.
        </p>
      </Card>
    );
  }

  async function getQuote() {
    setBusy("quote");
    setError(null);
    setHash(null);
    setQuote(null);
    try {
      const stroops = BigInt(Math.round(Number(amount) * 1e7));
      if (stroops <= 0n) throw new Error("Enter a positive XLM amount");
      const out = await quoteAmountOut(address, stroops);
      setQuote({ in: stroops, out });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function swap() {
    if (!quote || (!props.signXdr && !props.performSwap)) return;
    setBusy("swap");
    setError(null);
    setHash(null);
    try {
      const minOut = (quote.out * 99n) / 100n; // 1% max slippage
      let txHash: string;
      if (props.performSwap) {
        ({ hash: txHash } = await props.performSwap(quote.in, minOut));
      } else {
        const builtXdr = await buildSwapXdr(address, quote.in, minOut);
        const signed = await props.signXdr!(builtXdr);
        ({ hash: txHash } = await submitSignedXdr(signed));
      }
      setHash(txHash);
      setQuote(null);
      await refreshUsdc();
      await props.onSwapped?.();
    } catch (e) {
      const msg = errorMessage(e);
      setError(
        /account not found/i.test(msg)
          ? "This wallet isn't on-chain yet — fund it with friendbot (card above), then swap."
          : msg,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Swap on Soroswap (testnet)">
      <p className="muted small">
        XLM → tUSDC against the Soroswap AMM router: quote via simulation →
        build the swap invocation → <strong>sign with this kit</strong> →
        submit. tUSDC is Soroswap's faucet-minted test token, not Circle's
        USDC.
        {props.note ? ` ${props.note}` : ""}
      </p>
      <Field
        label="Amount in (XLM)"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setQuote(null);
          setHash(null);
        }}
      />
      <div className="row">
        <Button
          variant="ghost"
          onClick={() => void getQuote()}
          disabled={busy !== null || !amount.trim()}
        >
          {busy === "quote" ? "Quoting…" : "Get quote"}
        </Button>
        <Button onClick={() => void swap()} disabled={busy !== null || !quote}>
          {busy === "swap" ? "Signing & swapping…" : "Swap"}
        </Button>
      </div>
      {quote && (
        <p className="muted small">
          Quote: {amount} XLM → ≈ {(Number(quote.out) / 1e7).toFixed(4)} tUSDC ·
          Soroswap AMM · 1% max slippage
        </p>
      )}
      <p className="muted small">tUSDC balance: {usdc ?? "0"}</p>
      {hash && (
        <p className="success">
          Swapped!{" "}
          <a href={explorerTxUrl(hash)} target="_blank" rel="noreferrer">
            View on stellar.expert
          </a>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </Card>
  );
}
