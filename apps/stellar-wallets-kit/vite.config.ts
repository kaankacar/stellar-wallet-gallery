import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs so the build works under any path (GitHub Pages
  // serves each app at /<repo>/<app>/).
  base: "./",
  plugins: [react()],
  server: { port: 5180 },
});
