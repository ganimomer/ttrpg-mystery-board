import { asc, eq } from "drizzle-orm";
import type { Card, Tidbit } from "@board/shared";
import { db, schema } from "./db/index.js";
import { toCard, toTidbit } from "./mappers.js";

/** A card's tidbits in position order (unfiltered — caller shapes by role). */
export function loadTidbits(cardId: string): Tidbit[] {
  return db
    .select()
    .from(schema.noteItems)
    .where(eq(schema.noteItems.cardId, cardId))
    .orderBy(asc(schema.noteItems.position))
    .all()
    .map(toTidbit);
}

/** Full card (GM shape) including its ordered notepad, or null if missing. */
export function loadCardWithNotepad(cardId: string): Card | null {
  const row = db
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.id, cardId))
    .get();
  if (!row) return null;
  return toCard(row, loadTidbits(cardId));
}
