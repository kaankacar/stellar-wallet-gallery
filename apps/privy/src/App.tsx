import { PrivyProvider } from "@privy-io/react-auth";
import { DemoShell, NeedsKeyBanner, SigningExplainer } from "@gallery/shared";
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
      <SigningExplainer {...signingExplainer} />
    </DemoShell>
  );
}
