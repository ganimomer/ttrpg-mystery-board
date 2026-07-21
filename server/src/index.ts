import "./env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config.js";
import { bootstrapSchema } from "./db/index.js";
import { authRoutes } from "./auth/discord.js";
import { boardsRoutes, invitesRoutes } from "./routes/boards.js";
import { cardsRoutes } from "./routes/cards.js";
import { connectionsRoutes } from "./routes/connections.js";
import { eventsRoutes } from "./routes/events.js";
import { imageServeRoutes, imageUploadRoutes } from "./routes/images.js";
import type { AppEnv } from "./types.js";

bootstrapSchema();

const app = new Hono<AppEnv>();
app.use("*", logger());

// ─── API ─────────────────────────────────────────────────────────
const api = new Hono<AppEnv>();
api.get("/health", (c) => c.json({ ok: true }));
api.route("/auth", authRoutes);
api.route("/invites", invitesRoutes);
api.route("/boards", boardsRoutes);
api.route("/boards/:boardId/cards", cardsRoutes);
api.route("/boards/:boardId/connections", connectionsRoutes);
api.route("/boards/:boardId/images", imageUploadRoutes);
api.route("/boards/:boardId/events", eventsRoutes);
api.route("/images", imageServeRoutes);
app.route("/api", api);

// ─── Static client (production) ──────────────────────────────────
// In dev the client is served by Vite, which proxies /api here.
if (config.isProd) {
  const clientDir = fileURLToPath(new URL("../../client/dist", import.meta.url));
  app.use("/assets/*", serveStatic({ root: path.relative(process.cwd(), clientDir) }));
  app.use("/*", serveStatic({ root: path.relative(process.cwd(), clientDir) }));
  // SPA fallback for client-side routes (e.g. /join/:token). Only serve
  // index.html for navigation requests — a missing asset (…/foo.woff2, .js)
  // must 404, never return HTML that a browser would try to parse as that asset.
  app.notFound(async (c) => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "Not found" }, 404);
    const accept = c.req.header("Accept") ?? "";
    const looksLikeAsset = /\.[a-z0-9]+$/i.test(c.req.path);
    if (looksLikeAsset || !accept.includes("text/html")) {
      return c.json({ error: "Not found" }, 404);
    }
    const html = await readFile(path.join(clientDir, "index.html"), "utf8");
    return c.html(html);
  });
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`🧵  Mystery board server on http://localhost:${info.port}`);
});
