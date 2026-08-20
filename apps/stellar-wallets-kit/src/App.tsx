import { useCallback, useEffect, useState } from "react";
import {
  AccountCard,
  Button,
  Card,
  DemoShell,
  FriendbotCard,
  NETWORK_PASSPHRASE,
  PaymentCard,
  SigningExplainer,
  StatusNote,
  SwapCard,
  buildPaymentXdr,
  errorMessage,
  getXlmBalance,
  submitSignedXdr,
} from "@gallery/shared";
import { KitEventType, StellarWalletsKit } from "./kit";
import { signingExplainer } from "./explainer-content";

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setAccountError(null);
    setHash(null);
    setSendError(null);
  }, []);

  useEffect(() => {
    // The kit persists the connected address in localStorage; getAddress()
    // resolves with it on reload and throws when nothing is connected.
    StellarWalletsKit.getAddress()
      .then(({ address }) => setAddress(address))
      .catch(() => {
        /* no wallet connected yet */
      });
    // Fired when the user disconnects from the kit's built-in profile modal
    // (or when we call StellarWalletsKit.disconnect() ourselves).
    const unsubscribe = StellarWalletsKit.on(KitEventType.DISCONNECT, resetSession);
    return unsubscribe;
  }, [resetSession]);

  const refreshBalance = useCallback(async (addr: string) => {
    setAccountError(null);
    try {
      setBalance(await getXlmBalance(addr));
    } catch (e) {
      setAccountError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (address) void refreshBalance(address);
  }, [address, refreshBalance]);

  async function connect() {
    setConnectError(null);
    try {
      // Opens the kit's wallet-picker modal; resolves once the user has
      // picked a wallet and the kit fetched its active address.
      const { address } = await StellarWalletsKit.authModal();
      setAddress(address);
    } catch (e) {
      // Also rejects with { code: -1, message: "The user closed the modal." }
      setConnectError(errorMessage(e));
    }
  }

  async function disconnect() {
    try {
      await StellarWalletsKit.disconnect();
    } finally {
      resetSession();
    }
  }

  async function send(destination: string, amount: string) {
    if (!address) return;
    setSending(true);
    setHash(null);
    setSendError(null);
    try {
      const xdr = await buildPaymentXdr({ source: address, destination, amount });
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address,
      });
      const { hash: txHash } = await submitSignedXdr(signedTxXdr);
      setHash(txHash);
      await refreshBalance(address);
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <DemoShell
      kit="Stellar Wallets Kit"
      tagline="Creit Tech's multi-wallet connect kit — one modal and one signing API for Freighter, xBull, Albedo, Ledger, Lobstr, HOT and more."
      accent="#4f8ff7"
      accountKind="G"
    >
      {!address ? (
        <Card title="Connect">
          <p>
            Pick a wallet from the kit's built-in modal. The kit remembers the
            connection across reloads until you disconnect.
          </p>
          <div className="row">
            <Button onClick={connect}>Connect wallet</Button>
          </div>
          {connectError && <p className="error">{connectError}</p>}
          <StatusNote>
            Extension wallets (Freighter, xBull, Rabet, …) must be installed and
            unlocked to show as available — and switched to Testnet themselves.
          </StatusNote>
        </Card>
      ) : (
        <>
          <AccountCard
            address={address}
            balance={balance}
            onRefresh={() => void refreshBalance(address)}
            note="Your wallet's classic account — the extension holds the ed25519 key."
          />
          {accountError && <p className="error">{accountError}</p>}
          <FriendbotCard address={address} onFunded={() => refreshBalance(address)} />
          <PaymentCard
            onSend={(destination, amount) => void send(destination, amount)}
            busy={sending}
            hash={hash}
            error={sendError}
            note="buildPaymentXdr → StellarWalletsKit.signTransaction (wallet pop-up) → submit to Horizon testnet."
          />
          <SwapCard
            address={address}
            signXdr={async (xdr) =>
              (
                await StellarWalletsKit.signTransaction(xdr, {
                  networkPassphrase: NETWORK_PASSPHRASE,
                  address,
                })
              ).signedTxXdr
            }
            onSwapped={() => refreshBalance(address)}
            note="The wallet extension pops up to approve the Soroban swap, exactly like the payment."
          />
          <div className="row">
            <Button variant="ghost" onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </div>
        </>
      )}
      <SigningExplainer {...signingExplainer} />
    </DemoShell>
  );
}
