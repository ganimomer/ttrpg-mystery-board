// Loads environment variables from the repo-root .env before any other
// module reads process.env. Import this first from every entrypoint.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv });
} else {
  loadEnv(); // fall back to process cwd / real environment
}
