import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so the build works under any path (GitHub Pages
  // serves each app at /<repo>/<app>/).
  base: "./",
  plugins: [react()],
  define: {
    // Required for @stellar/stellar-sdk (and base64url) in the browser.
    global: "globalThis",
  },
  resolve: {
    alias: [
      // smart-account-kit's optional StellarWalletsKitAdapter dynamically
      // imports "@creit-tech/stellar-wallets-kit" (a JSR-only package we don't
      // use — note the hyphen: it is NOT the npm "@creit.tech/..." package).
      // Alias it (and its subpath imports) to an inert local stub so both the
      // dev optimizer and the production Rollup build can resolve it. The code
      // path never executes because we never construct the adapter.
      {
        find: /^@creit-tech\/stellar-wallets-kit(\/.*)?$/,
        replacement: fileURLToPath(
          new URL("./src/stellar-wallets-kit-stub.ts", import.meta.url),
        ),
      },
    ],
    // One copy of the SDK across @gallery/shared and smart-account-kit.
    dedupe: ["@stellar/stellar-sdk"],
  },
  optimizeDeps: {
    include: ["buffer"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
