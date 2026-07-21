import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireBoardGM, requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { loadCardWithNotepad } from "../cards.js";
import { db, schema } from "../db/index.js";
import { publishCardUpsert } from "../realtime/bus.js";
import { reorderOnReveal } from "../reveal.js";
import type { AppEnv } from "../types.js";

// Mounted at /api/boards/:boardId/cards/:cardId/tidbits
export const tidbitsRoutes = new Hono<AppEnv>();
tidbitsRoutes.use("*", requireAuth, requireBoardMember);

const createSchema = z.object({ text: z.string().max(2000).optional() });
const updateSchema = z.object({
  text: z.string().max(2000).optional(),
  revealed: z.boolean().optional(),
});

// Confirm the card exists on this board; returns it or null.
function cardOnBoard(cardId: string, boardId: string) {
  return db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .get();
}

function currentItems(cardId: string) {
  return db
    .select({ id: schema.noteItems.id, revealed: schema.noteItems.revealed })
    .from(schema.noteItems)
    .where(eq(schema.noteItems.cardId, cardId))
    .orderBy(asc(schema.noteItems.position))
    .all();
}

function persistOrder(items: { id: string }[]) {
  items.forEach((item, i) => {
    db.update(schema.noteItems)
      .set({ position: i })
      .where(eq(schema.noteItems.id, item.id))
      .run();
  });
}

// Add a tidbit (appended below existing items, un-revealed).
tidbitsRoutes.post("/", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId")!;
  if (!cardOnBoard(cardId, boardId)) {
    return c.json({ error: "Card not found" }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid tidbit" }, 400);

  const position = currentItems(cardId).length;
  db.insert(schema.noteItems)
    .values({
      id: nanoid(),
      cardId,
      boardId,
      text: parsed.data.text ?? "",
      revealed: false,
      position,
    })
    .run();

  const card = loadCardWithNotepad(cardId)!;
  publishCardUpsert(card);
  return c.json(card, 201);
});

// Edit a tidbit's text and/or revealed state (revealing re-slots it).
tidbitsRoutes.patch("/:tidbitId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId")!;
  const tidbitId = c.req.param("tidbitId")!;

  const existing = db
    .select()
    .from(schema.noteItems)
    .where(
      and(
        eq(schema.noteItems.id, tidbitId),
        eq(schema.noteItems.cardId, cardId),
        eq(schema.noteItems.boardId, boardId),
      ),
    )
    .get();
  if (!existing) return c.json({ error: "Tidbit not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid update" }, 400);
  const d = parsed.data;

  db.transaction((tx) => {
    if (d.text !== undefined) {
      tx.update(schema.noteItems)
        .set({ text: d.text })
        .where(eq(schema.noteItems.id, tidbitId))
        .run();
    }
    if (d.revealed !== undefined && d.revealed !== existing.revealed) {
      tx.update(schema.noteItems)
        .set({ revealed: d.revealed })
        .where(eq(schema.noteItems.id, tidbitId))
        .run();
      const reordered = reorderOnReveal(
        currentItems(cardId),
        tidbitId,
        d.revealed,
      );
      reordered.forEach((item, i) => {
        tx.update(schema.noteItems)
          .set({ position: i })
          .where(eq(schema.noteItems.id, item.id))
          .run();
      });
    }
  });

  const card = loadCardWithNotepad(cardId)!;
  publishCardUpsert(card);
  return c.json(card);
});

tidbitsRoutes.delete("/:tidbitId", requireBoardGM, (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId")!;
  const tidbitId = c.req.param("tidbitId")!;

  const existing = db
    .select({ id: schema.noteItems.id })
    .from(schema.noteItems)
    .where(
      and(
        eq(schema.noteItems.id, tidbitId),
        eq(schema.noteItems.cardId, cardId),
        eq(schema.noteItems.boardId, boardId),
      ),
    )
    .get();
  if (!existing) return c.json({ error: "Tidbit not found" }, 404);

  db.delete(schema.noteItems).where(eq(schema.noteItems.id, tidbitId)).run();
  persistOrder(currentItems(cardId)); // densify positions after removal

  const card = loadCardWithNotepad(cardId)!;
  publishCardUpsert(card);
  return c.json(card);
});
