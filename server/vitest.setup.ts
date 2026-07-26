// Provide dummy env so modules that import ./src/config.ts (which requires
// these) can load under test. Values are inert — no real Discord calls happen.
process.env.SESSION_SECRET ||= "test-session-secret-0123456789abcdef";
process.env.DISCORD_CLIENT_ID ||= "test-client-id";
process.env.DISCORD_CLIENT_SECRET ||= "test-client-secret";
process.env.GM_DISCORD_IDS ||= "111111111111111111";
process.env.DATA_DIR ||= "/tmp/board-vitest-data";
