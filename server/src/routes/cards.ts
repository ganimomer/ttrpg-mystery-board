import { and, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireBoardGM, requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { db, schema } from "../db/index.js";
import { toCard } from "../mappers.js";
import {
  publishCardRemove,
  publishCardUpsert,
  publishConnectionRemove,
} from "../realtime/bus.js";
import type { AppEnv } from "../types.js";

export const cardsRoutes = new Hono<AppEnv>();
cardsRoutes.use("*", requireAuth, requireBoardMember);

const createSchema = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imageId: z.string().nullable().optional(),
  x: z.number(),
  y: z.number(),
  rotation: z.number().min(-45).max(45).optional(),
  revealed: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imageId: z.string().nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().min(-45).max(45).optional(),
  revealed: z.boolean().optional(),
});

// Verify an imageId (if given) belongs to this board.
function imageBelongsToBoard(imageId: string, boardId: string): boolean {
  const row = db
    .select({ id: schema.images.id })
    .from(schema.images)
    .where(and(eq(schema.images.id, imageId), eq(schema.images.boardId, boardId)))
    .get();
  return !!row;
}

cardsRoutes.post("/", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid card" }, 400);
  const d = parsed.data;
  if (d.imageId && !imageBelongsToBoard(d.imageId, boardId)) {
    return c.json({ error: "Unknown image" }, 400);
  }

  const id = nanoid();
  db.insert(schema.cards)
    .values({
      id,
      boardId,
      title: d.title ?? "",
      note: d.note ?? "",
      imageId: d.imageId ?? null,
      x: Math.round(d.x),
      y: Math.round(d.y),
      rotation: Math.round(d.rotation ?? 0),
      revealed: d.revealed ?? false,
    })
    .run();

  const card = toCard(
    db.select().from(schema.cards).where(eq(schema.cards.id, id)).get()!,
  );
  publishCardUpsert(card);
  return c.json(card, 201);
});

cardsRoutes.patch("/:cardId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId");
  const existing = db
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .get();
  if (!existing) return c.json({ error: "Card not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid update" }, 400);
  const d = parsed.data;
  if (d.imageId && !imageBelongsToBoard(d.imageId, boardId)) {
    return c.json({ error: "Unknown image" }, 400);
  }

  db.update(schema.cards)
    .set({
      ...(d.title !== undefined && { title: d.title }),
      ...(d.note !== undefined && { note: d.note }),
      ...(d.imageId !== undefined && { imageId: d.imageId }),
      ...(d.x !== undefined && { x: Math.round(d.x) }),
      ...(d.y !== undefined && { y: Math.round(d.y) }),
      ...(d.rotation !== undefined && { rotation: Math.round(d.rotation) }),
      ...(d.revealed !== undefined && { revealed: d.revealed }),
    })
    .where(eq(schema.cards.id, cardId))
    .run();

  const card = toCard(
    db.select().from(schema.cards).where(eq(schema.cards.id, cardId)).get()!,
  );
  publishCardUpsert(card);
  return c.json(card);
});

cardsRoutes.delete("/:cardId", requireBoardGM, (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId");
  const existing = db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .get();
  if (!existing) return c.json({ error: "Card not found" }, 404);
  // Connections touching this card cascade-delete in the DB; capture their ids
  // first so we can tell connected clients to remove them too.
  const conns = db
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(
      or(
        eq(schema.connections.fromCardId, cardId),
        eq(schema.connections.toCardId, cardId),
      ),
    )
    .all();
  db.delete(schema.cards).where(eq(schema.cards.id, cardId)).run();
  publishCardRemove(boardId, cardId);
  for (const conn of conns) publishConnectionRemove(boardId, conn.id);
  return c.json({ ok: true });
});
