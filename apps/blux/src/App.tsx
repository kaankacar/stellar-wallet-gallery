import { useCallback, useEffect, useState } from "react";
import { BluxProvider, networks, useBlux } from "@bluxcc/react";
import {
  AccountCard,
  Button,
  Card,
  DemoShell,
  FriendbotCard,
  NeedsKeyBanner,
  PaymentCard,
  SigningExplainer,
  StatusNote,
  SwapCard,
  NETWORK_PASSPHRASE,
  buildPaymentXdr,
  errorMessage,
  getXlmBalance,
  submitSignedXdr,
} from "@gallery/shared";
import { signingExplainer } from "./explainer-content";

const ACCENT = "#ffd84d";
const TAGLINE =
  "Blux is an SCF-funded connect kit for Stellar dApps that onboards users through wallets, email, phone and social login (blux.cc).";
const DASHBOARD_URL = "https://dashboard.blux.cc";

const APP_ID = (import.meta.env.VITE_BLUX_APP_ID as string | undefined)?.trim();

export function Root() {
  if (!APP_ID) {
    return (
      <DemoShell kit="Blux" tagline={TAGLINE} accent={ACCENT} accountKind="G">
        <NeedsKeyBanner kit="Blux" vars={["VITE_BLUX_APP_ID"]} docsUrl={DASHBOARD_URL} />
        <StatusNote>
          Blux validates the app id against its API before allowing login or signing, so the
          provider is not mounted until <code>VITE_BLUX_APP_ID</code> is set.
        </StatusNote>
        <SigningExplainer {...signingExplainer} />
      </DemoShell>
    );
  }
  return (
    <BluxProvider
      config={{
        appId: APP_ID,
        appName: "Stellar Wallet Gallery",
        networks: [networks.testnet],
        defaultNetwork: networks.testnet,
        explorer: "stellarexpert",
        isPersistent: true,
        // Blux defaults to wallet-only; opt in to the non-crypto doors too.
        loginMethods: ["wallet", "email", "sms", "google", "passkey"],
        appearance: { accentColor: ACCENT },
      }}
    >
      <DemoShell kit="Blux" tagline={TAGLINE} accent={ACCENT} accountKind="G">
        <Flow />
        <SigningExplainer {...signingExplainer} />
      </DemoShell>
    </BluxProvider>
  );
}

function Flow() {
  const blux = useBlux();
  const address = blux.user?.address;
  if (!blux.isAuthenticated || !address) return <ConnectCard />;
  return <Wallet key={address} address={address} />;
}

function ConnectCard() {
  const blux = useBlux();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await blux.login(); // opens the Blux modal, resolves with the authenticated user
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Connect">
      <StatusNote>
        Log in through the Blux modal — a Stellar wallet (Freighter, xBull, Lobstr, Albedo, …) or
        any non-crypto method enabled for this app id in the Blux dashboard.
      </StatusNote>
      <div className="row">
        <Button onClick={() => void connect()} disabled={busy || !blux.isReady}>
          {busy ? "Waiting for Blux…" : blux.isReady ? "Connect with Blux" : "Loading Blux…"}
        </Button>
      </div>
      {error && <p className="error">{error}</p>}
    </Card>
  );
}

function Wallet(props: { address: string }) {
  const { address } = props;
  const blux = useBlux();

  const [balance, setBalance] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBalance(await getXlmBalance(address));
    } catch (e) {
      setFundError(errorMessage(e));
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = async (destination: string, amount: string) => {
    setBusy(true);
    setPayError(null);
    setHash(null);
    try {
      const xdr = await buildPaymentXdr({ source: address, destination, amount });
      const signed = await blux.signTransaction(xdr, { network: NETWORK_PASSPHRASE });
      if (typeof signed !== "string") {
        throw new Error(`Blux signTransaction returned an unexpected ${typeof signed}`);
      }
      const result = await submitSignedXdr(signed);
      setHash(result.hash);
      await refresh();
    } catch (e) {
      setPayError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AccountCard
        address={address}
        balance={balance}
        onRefresh={() => void refresh()}
        note={fundError ? `Balance: ${fundError}` : "Classic account behind whichever door you logged in through."}
      />
      <FriendbotCard address={address} onFunded={() => void refresh()} />
      <PaymentCard
        onSend={(destination, amount) => void send(destination, amount)}
        busy={busy}
        hash={hash}
        error={payError}
        disabled={balance === null}
      />
      <SwapCard
        address={address}
        signXdr={async (xdr) => {
          const signed = await blux.signTransaction(xdr, { network: NETWORK_PASSPHRASE });
          if (typeof signed !== "string") {
            throw new Error(`Blux signTransaction returned an unexpected ${typeof signed}`);
          }
          return signed;
        }}
        onSwapped={() => void refresh()}
        note="Blux routes the Soroban swap to whichever door you logged in through."
      />
      <div className="row">
        <Button variant="ghost" onClick={() => blux.logout()}>
          Disconnect
        </Button>
      </div>
    </>
  );
}
