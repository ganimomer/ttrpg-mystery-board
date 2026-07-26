function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return v;
}

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

  sessionSecret: required("SESSION_SECRET"),

  // Shared Postgres — the same URL across all horizontally-scaled instances.
  databaseUrl: required("DATABASE_URL"),
} as const;
