// Standalone entrypoint to create/upgrade the Postgres schema.
// Usage: npm run db:migrate
import "../env.js";
import { bootstrapSchema, sql } from "./index.js";

await bootstrapSchema();
console.log("Schema is up to date.");
await sql.end();
