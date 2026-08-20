import { useCallback, useEffect, useState } from "react";
import {
  AccountCard,
  Button,
  Card,
  DemoShell,
  Field,
  FriendbotCard,
  PaymentCard,
  SigningExplainer,
  StatusNote,
  SwapCard,
  errorMessage,
  getXlmBalance,
} from "@gallery/shared";
import { PasskeySigner, SignerKey, type StoredPasskey } from "passkey-kit";
import { indexer, kit, nativeToken, storage } from "./config";
import { submit } from "./relayer";
import { signingExplainer } from "./explainer-content";

/** Parse a decimal-XLM input into i128 stroops for the SAC transfer. */
function xlmToStroops(amount: string): bigint {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid amount: "${amount}"`);
  }
  return BigInt(Math.round(n * 10_000_000));
}

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredPasskey[]>([]);
  const [walletName, setWalletName] = useState("gallery-demo");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const refreshStored = useCallback(async () => {
    setStored(await storage.getAll().catch(() => []));
  }, []);

  // The kit's LocalStorageAdapter persists keyId → contractId records, so a
  // stored passkey can reconnect instantly (no WebAuthn discovery ceremony).
  useEffect(() => {
    void refreshStored();
  }, [refreshStored]);

  const refreshBalance = useCallback(async (addr: string) => {
    setAccountError(null);
    try {
      // Shared helper reads the native SAC balance of the C-address via RPC.
      setBalance(await getXlmBalance(addr));
    } catch (e) {
      setAccountError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (address) void refreshBalance(address);
  }, [address, refreshBalance]);

  /** Register a passkey and deploy a fresh smart wallet it controls. */
  async function create() {
    setConnecting(true);
    setConnectError(null);
    try {
      // WebAuthn registration ceremony (biometric prompt), then the kit
      // derives + builds the wallet deploy, signed by the shared deployer.
      const { keyIdBase64, contractId, signedTx } = await kit.createWallet(
        "Stellar Wallet Gallery",
        walletName.trim() || "gallery-demo",
      );
      try {
        // Fee-sponsored deploy via OZ Channels (keyless on testnet).
        await submit(signedTx);
      } catch (e) {
        kit.disconnect(); // don't stay "connected" to an undeployed wallet
        throw e;
      }
      setKeyId(keyIdBase64);
      setAddress(contractId);
      await refreshStored();
    } catch (e) {
      setConnectError(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  }

  /**
   * Connect an existing wallet. With a stored keyId this skips the WebAuthn
   * discovery ceremony entirely; without one, the browser prompts the user to
   * pick a passkey and the wallet is resolved via storage → Mercury's keyless
   * indexer → deterministic derivation, then ownership-verified on-chain.
   */
  async function connect(storedKeyId?: string) {
    setConnecting(true);
    setConnectError(null);
    try {
      const { keyIdBase64, contractId } = await kit.connectWallet({
        keyId: storedKeyId,
        getContractId: async (kid) => {
          const ids = await indexer
            ?.findWallets(SignerKey.Secp256r1(kid))
            .catch(() => [] as string[]);
          return ids?.[0];
        },
      });
      await storage.update(keyIdBase64, { lastUsedAt: Date.now() }).catch(() => {});
      setKeyId(keyIdBase64);
      setAddress(contractId);
      await refreshStored();
    } catch (e) {
      setConnectError(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    kit.disconnect();
    setAddress(null);
    setKeyId(null);
    setBalance(null);
    setAccountError(null);
    setHash(null);
    setSendError(null);
  }

  async function forgetStored() {
    await storage.clear().catch(() => {});
    await refreshStored();
    disconnect();
  }

  async function send(destination: string, amount: string) {
    if (!address) return;
    setSending(true);
    setHash(null);
    setSendError(null);
    try {
      // Native-XLM SAC transfer FROM the smart wallet (SEP-41 transfer).
      let at = await nativeToken.transfer({
        from: address,
        to: destination,
        amount: xlmToStroops(amount),
      });
      // Sign the wallet's auth entry with the passkey (WebAuthn prompt).
      at = await kit.sign(at, new PasskeySigner(keyId ?? undefined));
      // Fee-sponsored submission via OZ Channels.
      const { hash: txHash } = await submit(at);
      setHash(txHash);
      await refreshBalance(address);
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const latestStored = stored.length
    ? [...stored].sort(
        (a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt),
      )[0]
    : undefined;

  return (
    <DemoShell
      kit="Passkey Kit"
      tagline="Smart-wallet SDK where a WebAuthn passkey controls a Soroban contract wallet — now stewarded in the stellar GitHub org."
      accent="#29d3a2"
      accountKind="C"
    >
      {!address ? (
        <Card title="Connect">
          <p>
            Create a smart wallet — a Soroban contract (C-address) whose only
            signer is a passkey on this device — or reconnect an existing one.
          </p>
          <Field
            label="Wallet name (passkey label)"
            value={walletName}
            onChange={setWalletName}
            placeholder="gallery-demo"
          />
          <div className="row">
            <Button onClick={() => void create()} disabled={connecting}>
              {connecting ? "Working…" : "Create passkey wallet"}
            </Button>
            {latestStored && (
              <Button
                onClick={() => void connect(latestStored.keyId)}
                disabled={connecting}
              >
                Reconnect {latestStored.nickname ?? `${latestStored.keyId.slice(0, 8)}…`}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => void connect()}
              disabled={connecting}
            >
              Connect existing
            </Button>
          </div>
          {connectError && <p className="error">{connectError}</p>}
          <StatusNote>
            No credentials needed: wallet deploys are fee-sponsored through
            OpenZeppelin Relayer Channels (keyless on testnet); transfers
            submit via direct RPC with a throwaway friendbot-funded fee
            source. WebAuthn needs a secure context — http://localhost
            counts; passkeys are bound to this origin.
          </StatusNote>
        </Card>
      ) : (
        <>
          <AccountCard
            address={address}
            balance={balance}
            onRefresh={() => void refreshBalance(address)}
            note="Contract wallet controlled by your passkey — the balance lives in the native asset contract, not a classic account."
          />
          {accountError && <p className="error">{accountError}</p>}
          <FriendbotCard address={address} onFunded={() => refreshBalance(address)} />
          <PaymentCard
            onSend={(destination, amount) => void send(destination, amount)}
            busy={sending}
            hash={hash}
            error={sendError}
            disabled={balance === null}
            note="A G… destination must already exist on testnet."
          />
          <SwapCard address={address} />
          <div className="row">
            <Button variant="ghost" onClick={disconnect}>
              Disconnect
            </Button>
            <Button variant="ghost" onClick={() => void forgetStored()}>
              Forget stored passkeys
            </Button>
          </div>
        </>
      )}
      <SigningExplainer {...signingExplainer} />
    </DemoShell>
  );
}
