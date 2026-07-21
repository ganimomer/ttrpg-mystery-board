import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the client is served here and proxies /api to the Hono server, so the
// browser only ever talks to one origin (first-party cookies, no CORS, and
// relative /api paths that also work inside a Discord Activity later).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
