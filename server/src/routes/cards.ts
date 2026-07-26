import { and, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireBoardGM, requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { loadCardWithNotepad } from "../cards.js";
import { db, schema } from "../db/index.js";
import {
  publishCardRemove,
  publishCardUpsert,
  publishConnectionRemove,
} from "../realtime/bus.js";
import type { AppEnv } from "../types.js";

export const cardsRoutes = new Hono<AppEnv>();
cardsRoutes.use("*", requireAuth, requireBoardMember);

/**
 * Images are hotlinked, not uploaded — we only store the URL. Accept http/https
 * URLs up to 2048 chars and reject anything else (e.g. `data:`, `javascript:`),
 * so the stored string is always a safe, renderable `<img src>`.
 */
export function isSafeImageUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const imageUrlField = z
  .string()
  .refine(isSafeImageUrl, "Image URL must be an http(s) link under 2048 chars")
  .nullable()
  .optional();

const createSchema = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imageUrl: imageUrlField,
  x: z.number(),
  y: z.number(),
  rotation: z.number().min(-45).max(45).optional(),
  revealed: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imageUrl: imageUrlField,
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().min(-45).max(45).optional(),
  revealed: z.boolean().optional(),
});

cardsRoutes.post("/", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid card" }, 400);
  const d = parsed.data;

  const id = nanoid();
  await db.insert(schema.cards).values({
    id,
    boardId,
    title: d.title ?? "",
    note: d.note ?? "",
    imageUrl: d.imageUrl ?? null,
    x: Math.round(d.x),
    y: Math.round(d.y),
    rotation: Math.round(d.rotation ?? 0),
    revealed: d.revealed ?? false,
  });

  const card = (await loadCardWithNotepad(id))!;
  await publishCardUpsert(card);
  return c.json(card, 201);
});

cardsRoutes.patch("/:cardId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId");
  const [existing] = await db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .limit(1);
  if (!existing) return c.json({ error: "Card not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid update" }, 400);
  const d = parsed.data;

  await db
    .update(schema.cards)
    .set({
      ...(d.title !== undefined && { title: d.title }),
      ...(d.note !== undefined && { note: d.note }),
      ...(d.imageUrl !== undefined && { imageUrl: d.imageUrl }),
      ...(d.x !== undefined && { x: Math.round(d.x) }),
      ...(d.y !== undefined && { y: Math.round(d.y) }),
      ...(d.rotation !== undefined && { rotation: Math.round(d.rotation) }),
      ...(d.revealed !== undefined && { revealed: d.revealed }),
    })
    .where(eq(schema.cards.id, cardId));

  const card = (await loadCardWithNotepad(cardId))!;
  await publishCardUpsert(card);
  return c.json(card);
});

cardsRoutes.delete("/:cardId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const cardId = c.req.param("cardId");
  const [existing] = await db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .limit(1);
  if (!existing) return c.json({ error: "Card not found" }, 404);
  // Connections touching this card cascade-delete in the DB; capture their ids
  // first so we can tell connected clients to remove them too.
  const conns = await db
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(
      or(
        eq(schema.connections.fromCardId, cardId),
        eq(schema.connections.toCardId, cardId),
      ),
    );
  await db.delete(schema.cards).where(eq(schema.cards.id, cardId));
  await publishCardRemove(boardId, cardId);
  for (const conn of conns) await publishConnectionRemove(boardId, conn.id);
  return c.json({ ok: true });
});
