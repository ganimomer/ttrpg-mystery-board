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

async function cardOnBoard(cardId: string, boardId: string) {
  const [row] = await db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .limit(1);
  return row;
}

function currentItems(cardId: string) {
  return db
    .select({ id: schema.noteItems.id, revealed: schema.noteItems.revealed })
    .from(schema.noteItems)
    .where(eq(schema.noteItems.cardId, cardId))
    .orderBy(asc(schema.noteItems.position));
}

// Add a tidbit (appended below existing items, un-revealed).
tidbitsRoutes.post("/", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId")!;
  if (!(await cardOnBoard(cardId, boardId))) {
    return c.json({ error: "Card not found" }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid tidbit" }, 400);

  const position = (await currentItems(cardId)).length;
  await db.insert(schema.noteItems).values({
    id: nanoid(),
    cardId,
    boardId,
    text: parsed.data.text ?? "",
    revealed: false,
    position,
  });

  const card = (await loadCardWithNotepad(cardId))!;
  await publishCardUpsert(card);
  return c.json(card, 201);
});

// Edit a tidbit's text and/or revealed state (revealing re-slots it).
tidbitsRoutes.patch("/:tidbitId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId")!;
  const tidbitId = c.req.param("tidbitId")!;

  const [existing] = await db
    .select()
    .from(schema.noteItems)
    .where(
      and(
        eq(schema.noteItems.id, tidbitId),
        eq(schema.noteItems.cardId, cardId),
        eq(schema.noteItems.boardId, boardId),
      ),
    )
    .limit(1);
  if (!existing) return c.json({ error: "Tidbit not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid update" }, 400);
  const d = parsed.data;
  const revealChanged =
    d.revealed !== undefined && d.revealed !== existing.revealed;
  // Read the committed order up front; reorderOnReveal derives the new order
  // from the *other* items' revealed flags, so a pre-update read is correct.
  const reordered = revealChanged
    ? reorderOnReveal(await currentItems(cardId), tidbitId, d.revealed!)
    : null;

  await db.transaction(async (tx) => {
    if (d.text !== undefined) {
      await tx
        .update(schema.noteItems)
        .set({ text: d.text })
        .where(eq(schema.noteItems.id, tidbitId));
    }
    if (reordered) {
      await tx
        .update(schema.noteItems)
        .set({ revealed: d.revealed! })
        .where(eq(schema.noteItems.id, tidbitId));
      for (const [i, item] of reordered.entries()) {
        await tx
          .update(schema.noteItems)
          .set({ position: i })
          .where(eq(schema.noteItems.id, item.id));
      }
    }
  });

  const card = (await loadCardWithNotepad(cardId))!;
  await publishCardUpsert(card);
  return c.json(card);
});

tidbitsRoutes.delete("/:tidbitId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId")!;
  const tidbitId = c.req.param("tidbitId")!;

  const [existing] = await db
    .select({ id: schema.noteItems.id })
    .from(schema.noteItems)
    .where(
      and(
        eq(schema.noteItems.id, tidbitId),
        eq(schema.noteItems.cardId, cardId),
        eq(schema.noteItems.boardId, boardId),
      ),
    )
    .limit(1);
  if (!existing) return c.json({ error: "Tidbit not found" }, 404);

  await db.delete(schema.noteItems).where(eq(schema.noteItems.id, tidbitId));
  // Densify positions after removal.
  const remaining = await currentItems(cardId);
  for (const [i, item] of remaining.entries()) {
    await db
      .update(schema.noteItems)
      .set({ position: i })
      .where(eq(schema.noteItems.id, item.id));
  }

  const card = (await loadCardWithNotepad(cardId))!;
  await publishCardUpsert(card);
  return c.json(card);
});
