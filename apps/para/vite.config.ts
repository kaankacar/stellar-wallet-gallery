import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Para's SDK uses Node globals (Buffer & friends) in the browser — its Vite
// setup guide (docs.getpara.com → v3/react/setup/vite) requires this plugin.
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  // Relative asset URLs so the build works under any path (GitHub Pages
  // serves each app at /<repo>/<app>/).
  base: "./",
  plugins: [react(), nodePolyfills()],
  server: { port: 5183 },
  resolve: {
    alias: [
      // Para's SDK lazily `import("ethers")`s in its wagmi/EVM enhancer
      // paths, which this Stellar-only app never runs. Alias to an inert
      // stub so both the dev prebundler (esbuild) and the production build
      // (Rollup) can resolve the specifier — see src/ethers-stub.ts.
      {
        find: /^ethers$/,
        replacement: fileURLToPath(new URL("./src/ethers-stub.ts", import.meta.url)),
      },
    ],
  },
});
