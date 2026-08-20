import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Environment, ParaProvider } from "@getpara/react-sdk";
import { Card, DemoShell, NeedsKeyBanner, SigningExplainer, StatusNote } from "@gallery/shared";
import { WalletDemo } from "./WalletDemo";
import { signingExplainer } from "./explainer-content";

const API_KEY = (import.meta.env.VITE_PARA_API_KEY as string | undefined) ?? "";

// Modern Para API keys encode their environment in the key prefix
// (BETA_… / PROD_…); only legacy keys need `env` passed explicitly. A free
// developer-portal key is a BETA key, so BETA is the default here.
const ENV_MAP: Record<string, Environment> = {
  DEV: Environment.DEV,
  SANDBOX: Environment.SANDBOX,
  BETA: Environment.BETA,
  PROD: Environment.PROD,
};
const PARA_ENV =
  ENV_MAP[
    ((import.meta.env.VITE_PARA_ENVIRONMENT as string | undefined) ?? "BETA").toUpperCase()
  ] ?? Environment.BETA;

const queryClient = new QueryClient();

export function App() {
  return (
    <DemoShell
      kit="Para"
      tagline="MPC embedded-wallet infrastructure — users log in with email or social, key shares live in Para's distributed MPC network (no seed phrases), and Stellar support launched Aug 5, 2026."
      accent="#ff7b54"
      accountKind="G"
    >
      {API_KEY ? (
        <QueryClientProvider client={queryClient}>
          <ParaProvider
            paraClientConfig={{ apiKey: API_KEY, env: PARA_ENV }}
            config={{ appName: "Stellar Wallet Gallery" }}
            fallback={
              <Card title="Connect">
                <StatusNote>Loading Para…</StatusNote>
              </Card>
            }
          >
            <WalletDemo />
          </ParaProvider>
        </QueryClientProvider>
      ) : (
        <NeedsKeyBanner
          kit="Para"
          vars={["VITE_PARA_API_KEY"]}
          docsUrl="https://developer.getpara.com"
        />
      )}
      <SigningExplainer {...signingExplainer} />
    </DemoShell>
  );
}
