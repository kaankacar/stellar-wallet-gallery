import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountCard,
  Button,
  Card,
  DemoShell,
  Field,
  NeedsKeyBanner,
  PaymentCard,
  StatusNote,
  errorMessage,
  fundWithFriendbot,
  getXlmBalance,
} from "@gallery/shared";
import { LocalStorageAdapter, SmartAccountKit } from "smart-account-kit";
import type { IndexedContractSummary } from "smart-account-kit";
import { CONFIG, DOCS_URL, MISSING_VARS } from "./config";

const ACCENT = "#63b3ed";
const TAGLINE =
  "OpenZeppelin smart accounts on Stellar: passkey + multi-signer auth with policies and fee sponsorship, stewarded in the stellar org.";

type Session = { contractId: string; credentialId: string };

export default function App() {
  // Build the kit once. Session persistence (reconnect info) goes through the
  // kit's LocalStorageAdapter, so a page reload silently restores the wallet.
  const [kit, kitError] = useMemo<[SmartAccountKit | null, string | null]>(() => {
    try {
      return [
        new SmartAccountKit({
          rpcUrl: CONFIG.rpcUrl,
          networkPassphrase: CONFIG.networkPassphrase,
          accountWasmHash: CONFIG.accountWasmHash,
          webauthnVerifierAddress: CONFIG.webauthnVerifierAddress,
          relayerUrl: CONFIG.relayerUrl || undefined,
          storage: new LocalStorageAdapter("gallery-smart-account-kit"),
          rpName: "Stellar Wallet Gallery",
        }),
        null,
      ];
    } catch (e) {
      return [null, errorMessage(e)];
    }
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [userName, setUserName] = useState("gallery-user");
  const [connecting, setConnecting] = useState<null | "create" | "connect">(null);
  const [funding, setFunding] = useState(false);
  const [sending, setSending] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const refreshBalance = useCallback(async (contractId: string) => {
    try {
      setBalance(await getXlmBalance(contractId));
    } catch {
      setBalance(null);
    }
  }, []);

  // Silent restore of a stored session on page load.
  useEffect(() => {
    if (!kit) return;
    let cancelled = false;
    kit
      .connectWallet() // no options: restore from storage, null if none
      .then((restored) => {
        if (restored && !cancelled) {
          setSession({
            contractId: restored.contractId,
            credentialId: restored.credentialId,
          });
          void refreshBalance(restored.contractId);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [kit, refreshBalance]);

  const createWallet = useCallback(async () => {
    if (!kit) return;
    setConnecting("create");
    setConnectError(null);
    try {
      // Creates a passkey, deploys a fresh smart-account contract instance
      // (fees sponsored via the relayer proxy), and connects to it.
      const result = await kit.createWallet(
        "Stellar Wallet Gallery",
        userName.trim() || "gallery-user",
        { autoSubmit: true },
      );
      if (result.submitResult && !result.submitResult.success) {
        throw new Error(
          `Deployment failed [${result.submitResult.error.code}]: ${result.submitResult.error.message}`,
        );
      }
      setSession({ contractId: result.contractId, credentialId: result.credentialId });
      void refreshBalance(result.contractId);
    } catch (e) {
      setConnectError(errorMessage(e));
    } finally {
      setConnecting(null);
    }
  }, [kit, userName, refreshBalance]);

  const connectExisting = useCallback(async () => {
    if (!kit) return;
    setConnecting("connect");
    setConnectError(null);
    try {
      // 1. Authenticate to learn which passkey the user picked.
      const { credentialId } = await kit.authenticatePasskey();

      // 2. Best-effort indexer lookup of smart accounts for that credential.
      let contracts: IndexedContractSummary[] | null = null;
      try {
        contracts = await kit.discoverContractsByCredential(credentialId);
      } catch {
        contracts = null; // indexer down — fall through to derived address
      }

      // 3. Connect: indexed contract if found, else the deterministically
      //    derived contract address for this credential.
      const result =
        contracts && contracts.length > 0
          ? await kit.connectWallet({ contractId: contracts[0].contract_id, credentialId })
          : await kit.connectWallet({ credentialId });
      if (!result) throw new Error("No smart account found for that passkey.");
      setSession({ contractId: result.contractId, credentialId: result.credentialId });
      void refreshBalance(result.contractId);
    } catch (e) {
      setConnectError(errorMessage(e));
    } finally {
      setConnecting(null);
    }
  }, [kit, refreshBalance]);

  const disconnect = useCallback(async () => {
    if (kit) await kit.disconnect().catch(() => undefined);
    setSession(null);
    setBalance(null);
    setHash(null);
    setError(null);
  }, [kit]);

  const fund = useCallback(async () => {
    if (!session) return;
    setFunding(true);
    try {
      // Testnet friendbot funds C-addresses directly.
      await fundWithFriendbot(session.contractId);
      await refreshBalance(session.contractId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setFunding(false);
    }
  }, [session, refreshBalance]);

  const send = useCallback(
    async (destination: string, amount: string) => {
      if (!kit || !session) return;
      setSending(true);
      setHash(null);
      setError(null);
      try {
        const xlm = Number(amount);
        if (!Number.isFinite(xlm) || xlm <= 0) {
          throw new Error("Amount must be a positive number of XLM.");
        }
        // Native SAC `transfer` invocation authorized by the smart account and
        // signed with the passkey; submitted through the relayer (sponsored
        // fees) when configured, direct RPC otherwise. Amount is in XLM units.
        const result = await kit.transfer(CONFIG.nativeTokenContract, destination, xlm);
        if (result.success) {
          setHash(result.hash);
          void refreshBalance(session.contractId);
        } else {
          setError(`[${result.error.code}] ${result.error.message}`);
        }
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSending(false);
      }
    },
    [kit, session, refreshBalance],
  );

  return (
    <DemoShell kit="Smart Account Kit" tagline={TAGLINE} accent={ACCENT}>
      {MISSING_VARS.length > 0 && (
        <NeedsKeyBanner kit="Smart Account Kit" vars={MISSING_VARS} docsUrl={DOCS_URL} />
      )}

      {kitError && (
        <Card title="Kit failed to initialize">
          <p className="error">{kitError}</p>
        </Card>
      )}

      {kit && !session && (
        <Card title="Connect">
          <Field
            label="Passkey label (for new accounts)"
            value={userName}
            onChange={setUserName}
            placeholder="gallery-user"
          />
          <div className="row">
            <Button onClick={createWallet} disabled={connecting !== null}>
              {connecting === "create" ? "Creating…" : "Create smart account"}
            </Button>
            <Button variant="ghost" onClick={connectExisting} disabled={connecting !== null}>
              {connecting === "connect" ? "Connecting…" : "Connect existing"}
            </Button>
          </div>
          {connectError && <p className="error">{connectError}</p>}
          <StatusNote>
            Creates a WebAuthn passkey and deploys an OpenZeppelin smart-account
            contract (C-address) it controls. Deployment fees are sponsored by the
            testnet relayer proxy, so no funded account is needed.
          </StatusNote>
        </Card>
      )}

      {kit && session && (
        <>
          <AccountCard
            address={session.contractId}
            balance={balance}
            onRefresh={() => void refreshBalance(session.contractId)}
            onFund={() => void fund()}
            funding={funding}
            note="Contract wallet (C-address) controlled by your passkey."
          />
          <PaymentCard
            onSend={(destination, amount) => void send(destination, amount)}
            busy={sending}
            hash={hash}
            error={error}
            note={
              CONFIG.relayerUrl
                ? "Native XLM SAC transfer, authorized by the smart account and signed with your passkey. Fees are sponsored by the OpenZeppelin relayer — the wallet pays no fee."
                : "Native XLM SAC transfer signed with your passkey, submitted via direct RPC (no relayer configured)."
            }
          />
          <div className="row">
            <Button variant="ghost" onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </div>
        </>
      )}
    </DemoShell>
  );
}
