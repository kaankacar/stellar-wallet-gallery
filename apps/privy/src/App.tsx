import { PrivyProvider } from "@privy-io/react-auth";
import { Card, DemoShell, NeedsKeyBanner, SigningExplainer } from "@gallery/shared";
import { WalletDemo } from "./WalletDemo";
import { signingExplainer } from "./explainer-content";

const APP_ID = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? "";
const CLIENT_ID = (import.meta.env.VITE_PRIVY_CLIENT_ID as string | undefined) ?? "";

export function App() {
  return (
    <DemoShell
      kit="Privy"
      tagline="Embedded-wallet infrastructure powering 120M+ accounts — users log in with email or social and Privy manages the keys for them."
      accent="#6c5ce7"
      accountKind="G"
    >
      {APP_ID ? (
        <PrivyProvider
          appId={APP_ID}
          clientId={CLIENT_ID || undefined}
          config={{ appearance: { accentColor: "#6c5ce7" } }}
        >
          <WalletDemo />
        </PrivyProvider>
      ) : (
        <NeedsKeyBanner
          kit="Privy"
          vars={["VITE_PRIVY_APP_ID"]}
          docsUrl="https://dashboard.privy.io"
        />
      )}
      <Card title="Privy's chain tiers — where Stellar sits">
        <p className="muted small">
          Privy supports chains at three levels (docs.privy.io → chains):
        </p>
        <p className="muted small">
          <strong>Tier 3 — full functionality.</strong> End-to-end client
          support: transaction building and submission, native gas sponsorship,
          policies and webhooks. Ethereum (+ EVM chains), Solana (+ SVM),
          Tempo.
        </p>
        <p className="muted small">
          <strong>Tier 2 — wallet abstractions. Stellar lives here</strong>{" "}
          (with Bitcoin, Cosmos, Sui, TON, Near, …): wallet creation, chain
          address derivation, key export, and curve-level signatures for
          transaction signing — but no Stellar-aware transaction building.
          That's why this page builds the XDR itself, hashes it, and hands
          Privy exactly 32 bytes to sign.
        </p>
        <p className="muted small">
          <strong>Tier 1 — cryptographic signing.</strong> Raw signatures and
          basic key management only — Bitcoin L2s and other ed25519/secp256k1
          chains.
        </p>
      </Card>
      <SigningExplainer {...signingExplainer} />
    </DemoShell>
  );
}
