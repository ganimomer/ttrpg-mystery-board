import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return v;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

export const config = {
  port: Number(process.env.PORT ?? 8787),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:5173",
  isProd: process.env.NODE_ENV === "production",

  discord: {
    clientId: required("DISCORD_CLIENT_ID"),
    clientSecret: required("DISCORD_CLIENT_SECRET"),
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ??
      "http://localhost:8787/api/auth/discord/callback",
  },

  /** Discord user ids permitted to create boards and upload images. */
  gmDiscordIds: new Set(
    (process.env.GM_DISCORD_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),

  sessionSecret: required("SESSION_SECRET"),

  dataDir: DATA_DIR,
  uploadDir: UPLOAD_DIR,
  dbPath: path.join(DATA_DIR, "board.sqlite"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
} as const;

export function isGameMaster(userId: string): boolean {
  return config.gmDiscordIds.has(userId);
}
