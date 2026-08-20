/**
 * Browser-side fee-sponsored submission via OpenZeppelin Relayer Channels.
 *
 * passkey-kit >= 0.16 submits through OZ Channels (Launchtube is gone). The
 * SDK's own submitter (`PasskeyServer` / `RelayerClient`, `passkey-kit/server`)
 * is server-only because it holds a long-lived relayer API key. This module
 * mirrors `PasskeyServer.send`'s routing exactly — the same thing the upstream
 * repo's demo does in its browser `submit.ts` — but talks to the managed
 * testnet Channels endpoint directly, using a throwaway API key minted at
 * runtime from the keyless `GET {RELAYER_URL}/gen` endpoint (the identical
 * mechanism the repo's relayer-proxy worker uses to mint its per-IP keys).
 * There is no secret anywhere in this bundle.
 *
 * Routing (verbatim from PasskeyServer.send):
 *   - a SINGLE invokeHostFunction op without source-account auth is sent as
 *     `{ func, auth }` — the relayer builds the envelope around it with a
 *     channel account and pays the fees (covers SAC transfers AND the
 *     shared-deployer wallet deploy);
 *   - anything else is sent as a signed envelope `{ xdr }` for a fee bump.
 *
 * Wire protocol (verified against @openzeppelin/relayer-plugin-channels
 * 0.20.0 ChannelsClient): POST `${RELAYER_URL}/` with
 * `Authorization: Bearer <apiKey>` and body `{ params: {...} }`; response
 * `{ success, data: { transactionId, hash, status }, error? }`. Terminal
 * status regexes are kept identical to passkey-kit src/relayer.ts.
 */
import {
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
  type Transaction,
} from "@stellar/stellar-sdk";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { NETWORK_PASSPHRASE, RPC_URL, fundWithFriendbot } from "@gallery/shared";
import { RELAYER_API_KEY, RELAYER_URL } from "./config";

/** localStorage key for the runtime-minted (testnet, throwaway) API key. */
const API_KEY_CACHE = "gallery:passkey-kit:relayer-api-key";

/** Same request ceiling the SDK uses (testnet channel funding can be slow). */
const TIMEOUT_MS = 6 * 60 * 1000;

/** Terminal-success allowlist — keep identical to passkey-kit src/relayer.ts. */
const SUCCESS_STATUS = /\b(?:confirm(?:ed)?|success(?:ful)?)\b/i;
/** Terminal-failure statuses — keep identical to passkey-kit src/relayer.ts. */
const FAILURE_STATUS = /fail|error|revert|reject/i;

// `any` in the generic slot: submission only touches `.built`, which is
// independent of the result type, and AssembledTransaction is invariant in
// its type parameter — accept whatever the kit/SAC builders return.
type Submittable = AssembledTransaction<any> | Transaction | string;

interface ChannelsEnvelope {
  success?: boolean;
  error?: string;
  data?: { transactionId?: string; hash?: string; status?: string };
}

/** Mint a throwaway testnet API key from the keyless /gen endpoint. */
async function mintApiKey(): Promise<string> {
  const res = await fetch(`${RELAYER_URL}/gen`);
  if (!res.ok) {
    throw new Error(`Relayer key mint failed (HTTP ${res.status})`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Accepted field names mirror the repo's relayer-proxy worker.
  const key = [data.apiKey, data.api_key, data.key, data.token].find(
    (v): v is string => typeof v === "string" && v.trim().length >= 10,
  );
  if (!key) throw new Error("Relayer /gen response contained no API key");
  return key.trim();
}

async function getApiKey(forceNew: boolean): Promise<string> {
  if (RELAYER_API_KEY) return RELAYER_API_KEY;
  if (!forceNew) {
    const cached = localStorage.getItem(API_KEY_CACHE);
    if (cached) return cached;
  }
  const minted = await mintApiKey();
  localStorage.setItem(API_KEY_CACHE, minted);
  return minted;
}

/** Normalize any submittable input to a built Transaction. */
function toBuiltTransaction(input: Submittable): Transaction {
  if (typeof input === "string") {
    return TransactionBuilder.fromXDR(input, NETWORK_PASSPHRASE) as Transaction;
  }
  if (input instanceof AssembledTransaction) {
    if (!input.built) {
      throw new Error("AssembledTransaction has not been simulated/built yet");
    }
    return input.built;
  }
  return input;
}

/** Whether any invokeHostFunction op carries source-account auth. */
function hasSourceAccountAuth(transaction: Transaction): boolean {
  for (const op of transaction.operations) {
    if (op.type !== "invokeHostFunction") continue;
    for (const entry of (op as Operation.InvokeHostFunction).auth ?? []) {
      if (entry.credentials().switch().name === "sorobanCredentialsSourceAccount") {
        return true;
      }
    }
  }
  return false;
}

async function post(
  params: Record<string, unknown>,
  apiKey: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${RELAYER_URL}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ params }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether every auth entry uses credentials the HOSTED Channels plugin can
 * parse. The managed testnet deployment's XDR parser predates Protocol 27's
 * address-bound credentials (`sorobanCredentialsAddressV2`, discriminant 2 —
 * what passkey-kit >= 0.16 signs with, per CAP-0071-02), and 400s with
 * "unknown SorobanCredentialsType member for value 2" on the `{func,auth}`
 * lane. Verified live 2026-08-18.
 */
function hasOnlyLegacyCredentials(invokeOp: Operation.InvokeHostFunction): boolean {
  return (invokeOp.auth ?? []).every(
    (entry) => entry.credentials().switch().value <= 1,
  );
}

/** localStorage key for the throwaway testnet fee-source secret. */
const FEE_SOURCE_CACHE = "gallery:passkey-kit:fee-source-secret";

/**
 * Throwaway TESTNET fee-source keypair (friendbot-funded on first use). It
 * only sequences and signs the outer envelope on the `{xdr}` lane — the
 * relayer fee-bumps it, and it holds nothing but friendbot XLM.
 */
function getFeeSource(): Keypair {
  const cached = localStorage.getItem(FEE_SOURCE_CACHE);
  if (cached) return Keypair.fromSecret(cached);
  const kp = Keypair.random();
  localStorage.setItem(FEE_SOURCE_CACHE, kp.secret());
  return kp;
}

/**
 * Submit a passkey-signed invoke DIRECTLY via RPC, bypassing the relayer.
 *
 * Why: the managed Channels testnet deployment cannot parse Protocol 27
 * V2 credentials on EITHER lane — `{func,auth}` 400s in validation and
 * `{xdr}` 500s (TYPE_ERROR) when the plugin later parses the envelope
 * internally (both verified live 2026-08-18). Until the hosted plugin's
 * stellar-sdk is upgraded, V2-signed invokes can't ride the relayer at all.
 *
 * So: rebuild the invoke (signed V2 auth entries intact) around a throwaway
 * friendbot-funded fee source, `prepareTransaction` (re-simulates for
 * footprint/resources but keeps existing auth entries by design), sign the
 * envelope, and send via RPC. Not fee-sponsored — the fee source pays with
 * friendbot XLM. Deploys still ride the sponsored Channels lane (their
 * credentials parse fine there).
 */
async function submitDirectRpc(
  invokeOp: Operation.InvokeHostFunction,
): Promise<{ hash: string }> {
  const feeSource = getFeeSource();
  const server = new rpc.Server(RPC_URL);
  let account;
  try {
    account = await server.getAccount(feeSource.publicKey());
  } catch {
    await fundWithFriendbot(feeSource.publicKey());
    account = await server.getAccount(feeSource.publicKey());
  }
  const tx = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * 100).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({ func: invokeOp.func, auth: invokeOp.auth }),
    )
    .setTimeout(300)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(feeSource);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(
      `RPC submission failed: ${sent.errorResult?.result().switch().name ?? "unknown"}`,
    );
  }
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${sent.hash} ended with status ${final.status}`);
  }
  return { hash: sent.hash };
}

/**
 * Submit a signed transaction (AssembledTransaction, Transaction, or base64
 * envelope XDR) via the relayer. Resolves with the on-chain hash; throws a
 * plain Error with a readable message on any failure.
 */
export async function submit(input: Submittable): Promise<{ hash: string }> {
  const built = toBuiltTransaction(input);

  const op = built.operations[0];
  if (
    built.operations.length === 1 &&
    op?.type === "invokeHostFunction" &&
    !hasSourceAccountAuth(built)
  ) {
    const invokeOp = op as Operation.InvokeHostFunction;
    if (!hasOnlyLegacyCredentials(invokeOp)) {
      return submitDirectRpc(invokeOp);
    }
    return postAndParse({
      func: invokeOp.func.toXDR("base64"),
      auth: (invokeOp.auth ?? []).map((entry) => entry.toXDR("base64")),
    });
  }
  return postAndParse({ xdr: built.toXDR() });
}

async function postAndParse(
  params: Record<string, unknown>,
): Promise<{ hash: string }> {
  let res = await post(params, await getApiKey(false));
  if ((res.status === 401 || res.status === 403) && !RELAYER_API_KEY) {
    // A cached runtime-minted key may have expired — re-mint once and retry.
    res = await post(params, await getApiKey(true));
  }

  const text = await res.text();
  let envelope: ChannelsEnvelope = {};
  try {
    envelope = JSON.parse(text) as ChannelsEnvelope;
  } catch {
    /* non-JSON error body — handled below */
  }

  if (!res.ok || envelope.success === false) {
    // Surface the relayer's full response — its `details.message` carries the
    // underlying cause (e.g. the exact XDR parse error), not just the label.
    throw new Error(
      `Relayer request failed (HTTP ${res.status}): ${text.slice(0, 400)}`,
    );
  }

  const data = envelope.data ?? {};
  const status = data.status ?? "";
  if (!SUCCESS_STATUS.test(status)) {
    throw new Error(
      FAILURE_STATUS.test(status)
        ? `Relayer reported status "${status}"`
        : `Relayer status "${status || "unknown"}" is not terminal (pending)`,
    );
  }
  if (!data.hash) throw new Error("Relayer returned no transaction hash");
  return { hash: data.hash };
}
