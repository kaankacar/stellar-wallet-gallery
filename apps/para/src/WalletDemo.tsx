import { useCallback, useEffect, useRef, useState } from "react";
// All Para hooks come from the main entry point. The Stellar signer hook is
// re-exported there from @getpara/react-core/stellar and lazily loads
// @getpara/stellar-sdk-v14-integration + @stellar/stellar-sdk (^14) under the
// hood — docs: v3/react/guides/web3-operations/stellar/*.
import {
  useAccount,
  useCreateWallet,
  useLogout,
  useModal,
  useParaStellarSigner,
} from "@getpara/react-sdk";
import {
  AccountCard,
  Button,
  Card,
  FriendbotCard,
  NETWORK_PASSPHRASE,
  PaymentCard,
  StatusNote,
  buildPaymentXdr,
  errorMessage,
  getXlmBalance,
  submitSignedXdr,
} from "@gallery/shared";

export function WalletDemo() {
  const { openModal } = useModal();
  const account = useAccount();
  const { logoutAsync } = useLogout();
  const { createWalletAsync } = useCreateWallet();

  // Default networkPassphrase is Networks.PUBLIC — must pass testnet here.
  const {
    stellarSigner,
    isLoading: signerLoading,
    refetch: refetchSigner,
  } = useParaStellarSigner({ networkPassphrase: NETWORK_PASSPHRASE });

  // Para wallets are typed; Stellar is the "STELLAR" wallet type
  // (WALLET_TYPES = ['EVM','SOLANA','COSMOS','STELLAR','SUI']).
  const hasStellarWallet = !!account.embedded.wallets?.some((w) => w.type === "STELLAR");

  const address = stellarSigner?.address;

  const [creating, setCreating] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const createStellarWallet = useCallback(async () => {
    setCreating(true);
    setWalletError(null);
    try {
      await createWalletAsync({ type: "STELLAR" });
      await refetchSigner();
    } catch (e) {
      setWalletError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }, [createWalletAsync, refetchSigner]);

  // If the developer portal isn't configured to auto-create a Stellar wallet
  // at signup, create one on first login (same pattern as the other
  // embedded-wallet apps in this gallery).
  const creatingRef = useRef(false);
  useEffect(() => {
    if (
      !account.isConnected ||
      hasStellarWallet ||
      stellarSigner ||
      signerLoading ||
      creatingRef.current
    ) {
      return;
    }
    creatingRef.current = true;
    void createStellarWallet().finally(() => {
      creatingRef.current = false;
    });
  }, [account.isConnected, hasStellarWallet, stellarSigner, signerLoading, createStellarWallet]);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      setBalance(await getXlmBalance(address));
    } catch (e) {
      setFundError(errorMessage(e));
    }
  }, [address]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  async function handleSend(destination: string, amount: string) {
    if (!stellarSigner || !address) return;
    setSending(true);
    setSendError(null);
    setTxHash(null);
    try {
      // 1. Build the classic payment transaction (shared helper).
      const xdr = await buildPaymentXdr({ source: address, destination, amount });
      // 2. Para's Stellar signer: MPC nodes co-sign the tx hash with the
      //    wallet's ed25519 key and return the signed envelope XDR.
      const signedXdr = await stellarSigner.signTransactionXDR(xdr, NETWORK_PASSPHRASE);
      // 3. Submit to Horizon testnet (shared helper).
      const res = await submitSignedXdr(signedXdr);
      setTxHash(res.hash);
      await refreshBalance();
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (!account.isConnected) {
    return (
      <Card title="Connect">
        <p>
          Log in with email or a social account via the Para modal. Para splits the
          wallet key into MPC shares — no seed phrase, no extension — and the same
          embedded wallet works across every app built on Para.
        </p>
        <div className="row">
          <Button onClick={() => openModal()}>Log in with Para</Button>
        </div>
        {account.isLoading && <StatusNote>Checking session…</StatusNote>}
      </Card>
    );
  }

  const identity = account.embedded.email ?? account.embedded.userId ?? "unknown";

  return (
    <>
      <Card title="Session">
        <p className="muted small">Logged in as {identity}</p>
        <div className="row">
          <Button variant="ghost" onClick={() => void logoutAsync()}>
            Log out
          </Button>
        </div>
      </Card>

      {address ? (
        <>
          <AccountCard
            address={address}
            balance={balance}
            onRefresh={() => void refreshBalance()}
            note={
              fundError ??
              "Embedded Stellar wallet — an ed25519 MPC key held by Para's distributed network; the G-address is derived from the same key material."
            }
          />
          <FriendbotCard address={address} onFunded={() => void refreshBalance()} />
        </>
      ) : (
        <Card title="Account">
          {creating || signerLoading ? (
            <StatusNote>
              {creating ? "Creating your embedded Stellar wallet…" : "Loading Stellar wallet…"}
            </StatusNote>
          ) : (
            <>
              {walletError && <p className="error">{walletError}</p>}
              <div className="row">
                <Button onClick={() => void createStellarWallet()}>
                  Create Stellar wallet
                </Button>
              </div>
              <StatusNote>
                No Stellar wallet on this account yet — create one, or enable the
                Stellar wallet type for your project in the Para developer portal so
                it is created automatically at signup.
              </StatusNote>
            </>
          )}
        </Card>
      )}

      {address && (
        <PaymentCard
          onSend={(destination, amount) => void handleSend(destination, amount)}
          busy={sending}
          hash={txHash}
          error={sendError}
          note="buildPaymentXdr → ParaStellarSigner.signTransactionXDR (MPC ed25519 co-signing) → Horizon submit."
        />
      )}
    </>
  );
}
