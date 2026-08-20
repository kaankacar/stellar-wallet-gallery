import { useCallback, useEffect, useState } from "react";
import { Button, Card, Field } from "./ui";
import {
  errorMessage,
  explorerTxUrl,
  getTokenBalance,
  submitSignedXdr,
} from "./stellar";

const SOROSWAP_API = "https://api.soroswap.finance";
const API_KEY = ((import.meta as any).env?.VITE_SOROSWAP_API_KEY as string | undefined)?.trim();

/**
 * Soroswap testnet token contracts (from the public api.soroswap.finance
 * /api/tokens list, 2026-08-20). Testnet USDC is a PURE Soroban token
 * (name() = "USDCoin", verified via RPC) — not a classic-asset SAC — so
 * G-accounts receive it without a trustline; balances live in the contract.
 * Note: quarterly testnet resets change these; refresh from /api/tokens.
 */
export const TESTNET_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const TESTNET_USDC = "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F";

async function soroswapPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${SOROSWAP_API}${path}?network=testnet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? `Soroswap API: ${data.message}`
        : `Soroswap API ${res.status}: ${text.slice(0, 180)}`,
    );
  }
  return data;
}

/** Fish the output amount (stroops) out of the quote defensively. */
function quoteAmountOut(q: any): string | null {
  const candidates = [
    q?.amountOut,
    q?.expectedAmountOut,
    q?.trade?.expectedAmountOut,
    q?.trade?.amountOut,
    q?.trade?.amountOutMin,
    q?.minAmountOut,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && !Number.isNaN(Number(c))) {
      return (Number(c) / 1e7).toFixed(4);
    }
  }
  return null;
}

/**
 * XLM → USDC swap through the Soroswap aggregator API (testnet): quote →
 * build XDR → sign with the host app's kit (`signXdr`) → submit via Horizon.
 * Contract-wallet (C-address) apps get an explanatory state instead — the
 * API builds classic-source transactions.
 */
export function SwapCard(props: {
  address: string;
  signXdr?: (xdr: string) => Promise<string>;
  onSwapped?: () => void | Promise<void>;
  note?: string;
}) {
  const { address } = props;
  const isContract = address.startsWith("C");
  const [amount, setAmount] = useState("10");
  const [quote, setQuote] = useState<any | null>(null);
  const [busy, setBusy] = useState<null | "quote" | "swap">(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usdc, setUsdc] = useState<string | null>(null);

  const refreshUsdc = useCallback(async () => {
    if (isContract) return;
    setUsdc(await getTokenBalance(TESTNET_USDC, address));
  }, [address, isContract]);

  useEffect(() => {
    void refreshUsdc();
  }, [refreshUsdc]);

  if (isContract) {
    return (
      <Card title="Swap on Soroswap (testnet)">
        <p className="muted small">
          The Soroswap API builds classic-source transactions, so this contract
          wallet can't ride the same path: a smart-wallet swap means assembling
          the router invocation yourself and signing its auth entry with the
          passkey — the same machinery as the transfer above, one level deeper.
          Try the swap on the four G-account tabs to compare how each signer
          handles the exact same Soroban transaction.
        </p>
      </Card>
    );
  }

  if (!API_KEY) {
    return (
      <Card title="Swap on Soroswap (testnet)">
        <p className="muted small">
          Needs a free Soroswap API key: register at{" "}
          <a href="https://api.soroswap.finance/register" target="_blank" rel="noreferrer">
            api.soroswap.finance/register
          </a>
          , generate a key on the login page, and set{" "}
          <code>VITE_SOROSWAP_API_KEY</code> in this app's <code>.env</code>{" "}
          (and the repo's Actions secrets for the deployed site).
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
      const stroops = Math.round(Number(amount) * 1e7);
      if (!Number.isFinite(stroops) || stroops <= 0) {
        throw new Error("Enter a positive XLM amount");
      }
      const q = await soroswapPost("/quote", {
        assetIn: TESTNET_XLM,
        assetOut: TESTNET_USDC,
        amount: stroops,
        tradeType: "EXACT_IN",
        protocols: ["soroswap"],
        slippageBps: 100,
      });
      setQuote(q);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function swap() {
    if (!quote || !props.signXdr) return;
    setBusy("swap");
    setError(null);
    setHash(null);
    try {
      const built = await soroswapPost("/quote/build", {
        quote,
        from: address,
        to: address,
      });
      if (typeof built?.xdr !== "string") {
        throw new Error("Soroswap build returned no XDR");
      }
      const signed = await props.signXdr(built.xdr);
      const { hash: txHash } = await submitSignedXdr(signed);
      setHash(txHash);
      setQuote(null);
      await refreshUsdc();
      await props.onSwapped?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const out = quote ? quoteAmountOut(quote) : null;

  return (
    <Card title="Swap on Soroswap (testnet)">
      <p className="muted small">
        XLM → USDC through Soroswap's aggregator API: quote → build XDR →{" "}
        <strong>sign with this kit</strong> → submit.
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
          Quote: {amount} XLM → {out ? `≈ ${out} USDC` : "USDC"} · Soroswap AMM ·
          1% max slippage
        </p>
      )}
      <p className="muted small">USDC balance: {usdc ?? "0"}</p>
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
