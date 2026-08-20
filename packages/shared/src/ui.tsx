import { type CSSProperties, type ReactNode, useState } from "react";
import { errorMessage, explorerAccountUrl, explorerTxUrl, fundWithFriendbot } from "./stellar";

/**
 * Pill naming the account model. `kind` is the address prefix: G = classic
 * Stellar account (ed25519 keypair), C = Soroban smart-contract wallet.
 */
export function AccountKindBadge(props: { kind: "G" | "C"; long?: boolean }) {
  const c = props.kind === "C";
  const text = props.long
    ? c
      ? "Creates a C account — a Soroban smart-contract wallet"
      : "Creates a G account — a classic Stellar account"
    : c
      ? "C · contract wallet"
      : "G · classic account";
  return <span className={`kind-pill kind-${props.kind}`}>{text}</span>;
}

/** The gallery roster: local dev port + deployed sibling path per app. */
const GALLERY_APPS = [
  { slug: "stellar-wallets-kit", label: "Wallets Kit", port: "5180" },
  { slug: "blux", label: "Blux", port: "5181" },
  { slug: "privy", label: "Privy", port: "5182" },
  { slug: "para", label: "Para", port: "5183" },
  { slug: "passkey-kit", label: "Passkey Kit", port: "5184" },
  { slug: "smart-account-kit", label: "Smart Account", port: "5185" },
];

/**
 * Tab bar linking the six gallery apps. In local dev each app is its own Vite
 * server, so tabs link across localhost ports; on the deployed site all apps
 * live under one origin (/<repo>/<slug>/), so tabs are relative sibling links.
 * The active tab is derived from window.location — no per-app wiring needed.
 */
export function GalleryTabs() {
  const loc = window.location;
  const isDev = loc.port.startsWith("518");
  const current = isDev
    ? GALLERY_APPS.find((a) => a.port === loc.port)?.slug
    : GALLERY_APPS.find((a) => loc.pathname.includes(`/${a.slug}/`))?.slug;
  return (
    <nav className="tabs" aria-label="Wallet kits">
      {GALLERY_APPS.map((a) => (
        <a
          key={a.slug}
          className={a.slug === current ? "tab active" : "tab"}
          href={isDev ? `//${loc.hostname}:${a.port}/` : `../${a.slug}/`}
        >
          {a.label}
        </a>
      ))}
    </nav>
  );
}

export function DemoShell(props: {
  kit: string;
  tagline: string;
  accent?: string;
  accountKind?: "G" | "C";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const style = { "--accent": props.accent ?? "#7b6cff" } as CSSProperties;
  return (
    <div className="shell" style={style}>
      <GalleryTabs />
      <header className="shell-header">
        <div className="eyebrow">Stellar Wallet Gallery · Testnet</div>
        <h1>{props.kit}</h1>
        <p className="tagline">{props.tagline}</p>
        {props.accountKind && <AccountKindBadge kind={props.accountKind} long />}
      </header>
      <main className="shell-main">{props.children}</main>
      <footer className="shell-footer">
        {props.footer ?? "Same app, different wallet kit — Stellar Developers Meeting demo"}
      </footer>
    </div>
  );
}

export function Card(props: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={`btn ${props.variant ?? "primary"}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function AddressChip(props: { address: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${props.address.slice(0, 6)}…${props.address.slice(-6)}`;
  return (
    <span className="address-chip">
      <a href={explorerAccountUrl(props.address)} target="_blank" rel="noreferrer">
        <code>{short}</code>
      </a>
      <button
        type="button"
        className="copy"
        onClick={() => {
          navigator.clipboard.writeText(props.address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}

export function AccountCard(props: {
  address: string;
  balance: string | null;
  onRefresh: () => void;
  onFund?: () => void;
  funding?: boolean;
  onDisconnect?: () => void;
  note?: string;
}) {
  return (
    <Card title="Account">
      <div className="row">
        <AddressChip address={props.address} />
        <AccountKindBadge kind={props.address.startsWith("C") ? "C" : "G"} />
      </div>
      <p className="balance">
        {props.balance === null ? (
          <span className="muted">not funded yet</span>
        ) : (
          <>
            <strong>{props.balance}</strong> XLM
          </>
        )}
      </p>
      <div className="row">
        <Button variant="ghost" onClick={props.onRefresh}>
          Refresh balance
        </Button>
        {props.onFund && (
          <Button onClick={props.onFund} disabled={props.funding}>
            {props.funding ? "Funding…" : "Fund with friendbot"}
          </Button>
        )}
        {props.onDisconnect && (
          <Button variant="ghost" onClick={props.onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
      {props.note && <p className="muted small">{props.note}</p>}
    </Card>
  );
}

export function PaymentCard(props: {
  onSend: (destination: string, amount: string) => void;
  busy?: boolean;
  hash?: string | null;
  error?: string | null;
  disabled?: boolean;
  defaultDestination?: string;
  note?: string;
}) {
  const [destination, setDestination] = useState(props.defaultDestination ?? "");
  const [amount, setAmount] = useState("1");
  return (
    <Card title="Send XLM (testnet)">
      <Field
        label="Destination"
        value={destination}
        onChange={setDestination}
        placeholder="G… or C… address"
      />
      <Field label="Amount (XLM)" value={amount} onChange={setAmount} />
      <div className="row">
        <Button
          onClick={() => props.onSend(destination.trim(), amount.trim())}
          disabled={props.disabled || props.busy || !destination.trim() || !amount.trim()}
        >
          {props.busy ? "Signing & submitting…" : "Send payment"}
        </Button>
      </div>
      {props.hash && (
        <p className="success">
          Sent!{" "}
          <a href={explorerTxUrl(props.hash)} target="_blank" rel="noreferrer">
            View on stellar.expert
          </a>
        </p>
      )}
      {props.error && <p className="error">{props.error}</p>}
      {props.note && <p className="muted small">{props.note}</p>}
    </Card>
  );
}

/**
 * Fixed-format wallet-structure summary — the same five rows on every app so
 * the tabs compare like-for-like: Account / Key lives in / Signature /
 * Verified by / Fees.
 */
export function WalletAnatomy(props: {
  account: string;
  keyLivesIn: string;
  signature: string;
  verifiedBy: string;
  fees: string;
}) {
  const rows: Array<[string, string]> = [
    ["Account", props.account],
    ["Key lives in", props.keyLivesIn],
    ["Signature", props.signature],
    ["Verified by", props.verifiedBy],
    ["Fees", props.fees],
  ];
  return (
    <Card title="Wallet anatomy">
      <dl className="anatomy">
        {rows.map(([label, value]) => (
          <div key={label} className="anatomy-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Dedicated friendbot funding section, shown once a wallet is connected.
 * Self-contained: does the friendbot call itself and reports success/failure;
 * `onFunded` lets the host app refresh its balance display.
 */
export function FriendbotCard(props: { address: string; onFunded?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isC = props.address.startsWith("C");

  async function fund() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await fundWithFriendbot(props.address);
      setDone(true);
      await props.onFunded?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Fund with friendbot">
      <p className="muted small">
        Friendbot is the testnet faucet — free XLM for testing, one HTTP call.{" "}
        {isC
          ? "It funds C-addresses directly: 10,000 test XLM land in the contract wallet's native-asset balance."
          : "A classic G account doesn't exist on-chain until it's funded; friendbot creates it with 10,000 test XLM."}
      </p>
      <div className="row">
        <Button onClick={() => void fund()} disabled={busy}>
          {busy ? "Funding…" : "🤖 Fund this wallet"}
        </Button>
        {done && <span className="success">Funded — balance updated.</span>}
      </div>
      {error && <p className="error">{error}</p>}
    </Card>
  );
}

export function NeedsKeyBanner(props: { kit: string; vars: string[]; docsUrl: string }) {
  return (
    <div className="banner">
      <strong>{props.kit} needs credentials to run.</strong>
      <p>
        Set {props.vars.map((v, i) => (
          <span key={v}>
            {i > 0 && ", "}
            <code>{v}</code>
          </span>
        ))}{" "}
        in a <code>.env</code> file in this app's directory (see <code>.env.example</code>), then
        restart the dev server.
      </p>
      <p>
        <a href={props.docsUrl} target="_blank" rel="noreferrer">
          Get credentials →
        </a>
      </p>
    </div>
  );
}

export function StatusNote(props: { children: ReactNode }) {
  return <p className="muted small">{props.children}</p>;
}
