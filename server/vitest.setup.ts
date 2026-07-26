// Provide dummy env so modules that import ./src/config.ts (which requires
// these) can load under test. Values are inert — no real Discord calls happen.
// postgres.js connects lazily, so offline pure tests don't hit the DB.
process.env.SESSION_SECRET ||= "test-session-secret-0123456789abcdef";
process.env.DISCORD_CLIENT_ID ||= "test-client-id";
process.env.DISCORD_CLIENT_SECRET ||= "test-client-secret";
process.env.DATABASE_URL ||= "postgres://unused:unused@localhost:5432/unused";
