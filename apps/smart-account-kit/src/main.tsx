import "@gallery/shared/styles.css";

// Buffer polyfill for the browser (required by @stellar/stellar-sdk and
// smart-account-kit's base64url dependency) — must run before app code.
import { Buffer } from "buffer";
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
