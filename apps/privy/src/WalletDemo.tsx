import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, type User, type WalletWithMetadata } from "@privy-io/react-auth";
// Stellar is a Privy "extended chain" (tier 2): wallet creation + raw ed25519
// hash signing live in the /extended-chains entry point, NOT in the main one.
// https://docs.privy.io/wallets/wallets/create/create-a-wallet
// https://docs.privy.io/wallets/using-wallets/other-chains/raw-sign
import { useCreateWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  AccountCard,
  Button,
  Card,
  NETWORK_PASSPHRASE,
  PaymentCard,
  StatusNote,
  buildPaymentXdr,
  errorMessage,
  fundWithFriendbot,
  getXlmBalance,
  submitSignedXdr,
} from "@gallery/shared";
import { hexToBase64 } from "./signing";

/** The user's embedded Stellar wallet (G-address), if one exists yet. */
function findStellarWallet(user: User | null): WalletWithMetadata | undefined {
  return user?.linkedAccounts.find(
    (account): account is WalletWithMetadata =>
      account.type === "wallet" && account.chainType === "stellar",
  );
}

export function WalletDemo() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();

  const stellarWallet = findStellarWallet(user);
  const address = stellarWallet?.address;

  const [creating, setCreating] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Create the embedded Stellar wallet on first login. Extended-chain wallets
  // are NOT auto-created by Privy on login (unlike EVM/Solana, which have a
  // createOnLogin config) — the app calls createWallet({chainType: 'stellar'}).
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || stellarWallet || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setWalletError(null);
    createWallet({ chainType: "stellar" })
      // Success refreshes usePrivy().user, so stellarWallet appears above.
      .catch((e) => setWalletError(errorMessage(e)))
      .finally(() => {
        creatingRef.current = false;
        setCreating(false);
      });
  }, [ready, authenticated, stellarWallet, createWallet]);

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

  async function handleFund() {
    if (!address) return;
    setFunding(true);
    setFundError(null);
    try {
      await fundWithFriendbot(address);
      await refreshBalance();
    } catch (e) {
      setFundError(errorMessage(e));
    } finally {
      setFunding(false);
    }
  }

  async function handleSend(destination: string, amount: string) {
    if (!address) return;
    setSending(true);
    setSendError(null);
    setTxHash(null);
    try {
      // 1. Build the classic payment transaction (shared helper).
      const xdr = await buildPaymentXdr({ source: address, destination, amount });
      const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
      // 2. Privy signs the 32-byte Stellar transaction hash with the wallet's
      //    ed25519 key ("signs the provided hash directly without any
      //    additional byte manipulation") — exactly what a classic Stellar
      //    signature is.
      const hashHex: `0x${string}` = `0x${tx.hash().toString("hex")}`;
      const { signature } = await signRawHash({
        address,
        chainType: "stellar",
        hash: hashHex,
      });
      // 3. Attach the raw signature; addSignature() derives the hint from the
      //    G-address and verifies the signature against the tx hash.
      tx.addSignature(address, hexToBase64(signature));
      // 4. Submit to Horizon testnet (shared helper).
      const res = await submitSignedXdr(tx.toXDR());
      setTxHash(res.hash);
      await refreshBalance();
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (!ready) {
    return (
      <Card title="Connect">
        <StatusNote>Loading Privy…</StatusNote>
      </Card>
    );
  }

  if (!authenticated) {
    return (
      <Card title="Connect">
        <p>
          Log in with email or a social account. Privy then creates an embedded
          Stellar wallet for the user — no seed phrase, no extension; keys are
          managed in Privy&apos;s TEE-backed infrastructure.
        </p>
        <div className="row">
          <Button onClick={() => login()}>Log in with Privy</Button>
        </div>
      </Card>
    );
  }

  const identity = user?.email?.address ?? user?.google?.email ?? user?.id ?? "unknown";

  return (
    <>
      <Card title="Session">
        <p className="muted small">Logged in as {identity}</p>
        <div className="row">
          <Button variant="ghost" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </Card>

      {address ? (
        <AccountCard
          address={address}
          balance={balance}
          onRefresh={() => void refreshBalance()}
          onFund={() => void handleFund()}
          funding={funding}
          note={
            fundError ??
            "Embedded Stellar wallet — a Privy 'extended chain' (tier 2) ed25519 key that derives a native G-address."
          }
        />
      ) : (
        <Card title="Account">
          {creating ? (
            <StatusNote>Creating your embedded Stellar wallet…</StatusNote>
          ) : (
            <>
              {walletError && <p className="error">{walletError}</p>}
              <div className="row">
                <Button
                  onClick={() => {
                    setWalletError(null);
                    setCreating(true);
                    createWallet({ chainType: "stellar" })
                      .catch((e) => setWalletError(errorMessage(e)))
                      .finally(() => setCreating(false));
                  }}
                >
                  Create Stellar wallet
                </Button>
              </div>
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
          note="buildPaymentXdr → Privy signRawHash (ed25519 over the tx hash) → tx.addSignature → Horizon submit."
        />
      )}
    </>
  );
}
