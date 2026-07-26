import { asc, eq } from "drizzle-orm";
import type { Card, Connection, Tidbit } from "@board/shared";
import { db, schema } from "./db/index.js";
import { toCard, toConnection, toTidbit } from "./mappers.js";

/** A card's tidbits in position order (unfiltered — caller shapes by role). */
export async function loadTidbits(cardId: string): Promise<Tidbit[]> {
  const rows = await db
    .select()
    .from(schema.noteItems)
    .where(eq(schema.noteItems.cardId, cardId))
    .orderBy(asc(schema.noteItems.position));
  return rows.map(toTidbit);
}

/** Full card (GM shape) including its ordered notepad, or null if missing. */
export async function loadCardWithNotepad(cardId: string): Promise<Card | null> {
  const [row] = await db
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.id, cardId))
    .limit(1);
  if (!row) return null;
  return toCard(row, await loadTidbits(cardId));
}

/** A single connection by id, or null if missing. */
export async function loadConnection(id: string): Promise<Connection | null> {
  const [row] = await db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, id))
    .limit(1);
  return row ? toConnection(row) : null;
}
