// Standalone entrypoint to create/upgrade the SQLite schema.
// Usage: npm run db:migrate
import "../env.js";
import { bootstrapSchema } from "./index.js";

bootstrapSchema();
console.log("Schema is up to date.");
