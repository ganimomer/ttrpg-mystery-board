import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireBoardGM, requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { db, schema } from "../db/index.js";
import { toConnection } from "../mappers.js";
import {
  publishConnectionRemove,
  publishConnectionUpsert,
} from "../realtime/bus.js";
import type { AppEnv } from "../types.js";

export const connectionsRoutes = new Hono<AppEnv>();
connectionsRoutes.use("*", requireAuth, requireBoardMember);

const HEX = /^#[0-9a-fA-F]{6}$/;

const createSchema = z.object({
  fromCardId: z.string(),
  toCardId: z.string(),
  label: z.string().max(200).optional(),
  color: z.string().regex(HEX).optional(),
  revealed: z.boolean().optional(),
});

const updateSchema = z.object({
  label: z.string().max(200).optional(),
  color: z.string().regex(HEX).optional(),
  revealed: z.boolean().optional(),
});

function cardOnBoard(cardId: string, boardId: string): boolean {
  return !!db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .get();
}

connectionsRoutes.post("/", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid connection" }, 400);
  const d = parsed.data;
  if (d.fromCardId === d.toCardId) {
    return c.json({ error: "A string needs two different cards" }, 400);
  }
  if (!cardOnBoard(d.fromCardId, boardId) || !cardOnBoard(d.toCardId, boardId)) {
    return c.json({ error: "Both cards must be on this board" }, 400);
  }

  const id = nanoid();
  db.insert(schema.connections)
    .values({
      id,
      boardId,
      fromCardId: d.fromCardId,
      toCardId: d.toCardId,
      label: d.label ?? "",
      color: d.color ?? "#c0392b",
      revealed: d.revealed ?? false,
    })
    .run();

  const conn = toConnection(
    db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, id))
      .get()!,
  );
  publishConnectionUpsert(conn);
  return c.json(conn, 201);
});

connectionsRoutes.patch("/:connectionId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const connectionId = c.req.param("connectionId");
  const existing = db
    .select()
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.id, connectionId),
        eq(schema.connections.boardId, boardId),
      ),
    )
    .get();
  if (!existing) return c.json({ error: "Connection not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid update" }, 400);
  const d = parsed.data;

  db.update(schema.connections)
    .set({
      ...(d.label !== undefined && { label: d.label }),
      ...(d.color !== undefined && { color: d.color }),
      ...(d.revealed !== undefined && { revealed: d.revealed }),
    })
    .where(eq(schema.connections.id, connectionId))
    .run();

  const conn = toConnection(
    db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, connectionId))
      .get()!,
  );
  publishConnectionUpsert(conn);
  return c.json(conn);
});

connectionsRoutes.delete("/:connectionId", requireBoardGM, (c) => {
  const boardId = c.get("boardId");
  const connectionId = c.req.param("connectionId");
  const existing = db
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.id, connectionId),
        eq(schema.connections.boardId, boardId),
      ),
    )
    .get();
  if (!existing) return c.json({ error: "Connection not found" }, 404);
  db.delete(schema.connections)
    .where(eq(schema.connections.id, connectionId))
    .run();
  publishConnectionRemove(boardId, connectionId);
  return c.json({ ok: true });
});
