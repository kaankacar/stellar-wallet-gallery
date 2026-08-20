import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs so the build works under any path (GitHub Pages
  // serves each app at /<repo>/<app>/).
  base: "./",
  plugins: [react()],
  server: { port: 5184 },
  define: {
    // stellar-sdk / passkey-kit expect a Node-style `global`; map it to the
    // browser realm. `Buffer` itself is polyfilled at runtime in src/polyfills.ts.
    // (Same setup as the upstream passkey-kit demo's vite.config.ts.)
    global: "globalThis",
  },
  resolve: {
    // passkey-kit, its generated clients (passkey-kit-sdk / sac-sdk), the
    // shared package, and this app all import @stellar/stellar-sdk and buffer.
    // Dedupe to a single instance so xdr/Buffer `instanceof` checks hold.
    dedupe: ["@stellar/stellar-sdk", "buffer"],
  },
  optimizeDeps: {
    include: ["@stellar/stellar-sdk", "buffer"],
  },
  build: {
    target: "esnext",
  },
});
