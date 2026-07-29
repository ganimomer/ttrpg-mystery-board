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

/** A group's frame. Big enough to hold cards, small enough to stay on a board. */
const frameField = z
  .object({
    width: z.number().int().min(240).max(6000),
    height: z.number().int().min(200).max(6000),
  })
  .nullable()
  .optional();

const groupIdField = z.string().max(40).nullable().optional();

/** What the card is. No `group`: that is read off the frame, never stored. */
const entityTypeField = z.enum(["person", "thing", "place"]).nullable().optional();

const createSchema = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imageUrl: imageUrlField,
  x: z.number(),
  y: z.number(),
  rotation: z.number().min(-45).max(45).optional(),
  revealed: z.boolean().optional(),
  entityType: entityTypeField,
  groupId: groupIdField,
  frame: frameField,
});

const updateSchema = z.object({
  title: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imageUrl: imageUrlField,
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().min(-45).max(45).optional(),
  revealed: z.boolean().optional(),
  entityType: entityTypeField,
  groupId: groupIdField,
  frame: frameField,
});

/**
 * A card may only join a group on its own board, headed by a card that actually
 * carries a frame — and never itself. Cheap to check, and it keeps nonsense
 * (a card grouped into another board's card, or into itself) out of the table.
 */
async function groupIsUsable(
  boardId: string,
  cardId: string,
  groupId: string,
): Promise<boolean> {
  if (groupId === cardId) return false;
  const [row] = await db
    .select({ frameWidth: schema.cards.frameWidth })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, groupId), eq(schema.cards.boardId, boardId)))
    .limit(1);
  return !!row && row.frameWidth !== null;
}

/** The columns a frame lives in — one concept, two nullable integers. */
function frameColumns(frame: { width: number; height: number } | null) {
  return frame
    ? { frameWidth: frame.width, frameHeight: frame.height }
    : { frameWidth: null, frameHeight: null };
}

cardsRoutes.post("/", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid card" }, 400);
  const d = parsed.data;

  const id = nanoid();
  const groupId =
    d.groupId && (await groupIsUsable(boardId, id, d.groupId)) ? d.groupId : null;
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
    entityType: d.entityType ?? null,
    groupId,
    ...frameColumns(d.frame ?? null),
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

  if (d.groupId && !(await groupIsUsable(boardId, cardId, d.groupId))) {
    return c.json({ error: "No such group on this board" }, 400);
  }

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
      ...(d.entityType !== undefined && { entityType: d.entityType }),
      ...(d.groupId !== undefined && { groupId: d.groupId }),
      ...(d.frame !== undefined && frameColumns(d.frame)),
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
  // Deleting a group's card releases its members. The FK would do it silently
  // (ON DELETE SET NULL), so do it here instead and publish each released card —
  // otherwise other browsers keep showing them as grouped until a reload.
  const members = await db
    .update(schema.cards)
    .set({ groupId: null })
    .where(eq(schema.cards.groupId, cardId))
    .returning({ id: schema.cards.id });

  await db.delete(schema.cards).where(eq(schema.cards.id, cardId));
  await publishCardRemove(boardId, cardId);
  for (const conn of conns) await publishConnectionRemove(boardId, conn.id);
  for (const member of members) {
    const card = await loadCardWithNotepad(member.id);
    if (card) await publishCardUpsert(card);
  }
  return c.json({ ok: true });
});
