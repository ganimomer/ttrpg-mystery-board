import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

// One shared Postgres. postgres.js connects lazily (first query), so importing
// this module never opens a socket — offline unit tests stay offline.
export const sql = postgres(config.databaseUrl);
export const db = drizzle(sql, { schema });
export { schema };

/**
 * Idempotent schema bootstrap, kept in lock-step with schema.ts. Simpler and
 * more transparent than a migration runner for this app; swap to drizzle-kit
 * migrations if the schema grows. Safe to run on every boot / every instance.
 */
export async function bootstrapSchema(): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS board_members (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (board_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      token TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      x INTEGER NOT NULL DEFAULT 0,
      y INTEGER NOT NULL DEFAULT 0,
      rotation INTEGER NOT NULL DEFAULT 0,
      revealed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS cards_board_idx ON cards(board_id);
    -- Upgrade path from the pre-URL schema (harmless if the column exists).
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_url TEXT;
    -- Groups. A card carrying a frame size *is* a group; group_id is the card
    -- heading the group this one belongs to. SET NULL, so deleting a group's
    -- card releases its members instead of deleting them.
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS group_id TEXT
      REFERENCES cards(id) ON DELETE SET NULL;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS frame_width INTEGER;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS frame_height INTEGER;
    CREATE INDEX IF NOT EXISTS cards_group_idx ON cards(group_id);

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      from_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      to_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#c0392b',
      revealed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS connections_board_idx ON connections(board_id);

    CREATE TABLE IF NOT EXISTS note_items (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      revealed BOOLEAN NOT NULL DEFAULT false,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS note_items_card_idx ON note_items(card_id);
  `);
}
