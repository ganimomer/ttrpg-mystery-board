import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the client is served here and proxies /api to the Hono server, so the
// browser only ever talks to one origin (first-party cookies, no CORS, and
// relative /api paths that also work inside a Discord Activity).
export default defineConfig({
  plugins: [react()],
  // Read VITE_* vars (e.g. VITE_DISCORD_CLIENT_ID) from the repo-root .env.
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  server: {
    port: 5173,
    // A Discord Activity loads this dev server through an HTTPS tunnel
    // (cloudflared) inside an iframe: accept the tunnel's Host header and run
    // HMR over 443.
    allowedHosts: true,
    hmr: { clientPort: 443 },
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
