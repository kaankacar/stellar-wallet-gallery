import React from "react";
import ReactDOM from "react-dom/client";
import "@gallery/shared/styles.css";
// Required for the Para modal to display correctly (docs: v3/react/setup/vite).
import "@getpara/react-sdk/styles.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
