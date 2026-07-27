import { findStringBetween } from "@board/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireBoardGM, requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { loadConnection } from "../cards.js";
import { db, schema } from "../db/index.js";
import {
  publishConnectionRemove,
  publishConnectionUpsert,
} from "../realtime/bus.js";
import type { AppEnv } from "../types.js";

export const connectionsRoutes = new Hono<AppEnv>();
connectionsRoutes.use("*", requireAuth, requireBoardMember);

const HEX = /^#[0-9a-fA-F]{6}$/;

const ALREADY_TIED = "These cards are already strung together";

/** Postgres unique_violation, i.e. the pair index rejected the row. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "23505"
  );
}

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

async function cardOnBoard(cardId: string, boardId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.boardId, boardId)))
    .limit(1);
  return !!row;
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
  if (
    !(await cardOnBoard(d.fromCardId, boardId)) ||
    !(await cardOnBoard(d.toCardId, boardId))
  ) {
    return c.json({ error: "Both cards must be on this board" }, 400);
  }

  // One string per pair of cards. A board carries few enough of them that
  // reading the lot and asking the shared predicate beats a bespoke query.
  const existing = await db
    .select({
      fromCardId: schema.connections.fromCardId,
      toCardId: schema.connections.toCardId,
    })
    .from(schema.connections)
    .where(eq(schema.connections.boardId, boardId));
  if (findStringBetween(existing, d)) return c.json({ error: ALREADY_TIED }, 409);

  const id = nanoid();
  try {
    await db.insert(schema.connections).values({
      id,
      boardId,
      fromCardId: d.fromCardId,
      toCardId: d.toCardId,
      label: d.label ?? "",
      color: d.color ?? "#c0392b",
      revealed: d.revealed ?? false,
    });
  } catch (e) {
    // Two GMs tacking the same pair at once: the unique index is the real
    // guard, the read above is only there to give a friendly answer first.
    if (isUniqueViolation(e)) return c.json({ error: ALREADY_TIED }, 409);
    throw e;
  }

  const conn = (await loadConnection(id))!;
  await publishConnectionUpsert(conn);
  return c.json(conn, 201);
});

connectionsRoutes.patch("/:connectionId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const connectionId = c.req.param("connectionId");
  const [existing] = await db
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.id, connectionId),
        eq(schema.connections.boardId, boardId),
      ),
    )
    .limit(1);
  if (!existing) return c.json({ error: "Connection not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid update" }, 400);
  const d = parsed.data;

  await db
    .update(schema.connections)
    .set({
      ...(d.label !== undefined && { label: d.label }),
      ...(d.color !== undefined && { color: d.color }),
      ...(d.revealed !== undefined && { revealed: d.revealed }),
    })
    .where(eq(schema.connections.id, connectionId));

  const conn = (await loadConnection(connectionId))!;
  await publishConnectionUpsert(conn);
  return c.json(conn);
});

connectionsRoutes.delete("/:connectionId", requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const connectionId = c.req.param("connectionId");
  const [existing] = await db
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.id, connectionId),
        eq(schema.connections.boardId, boardId),
      ),
    )
    .limit(1);
  if (!existing) return c.json({ error: "Connection not found" }, 404);
  await db
    .delete(schema.connections)
    .where(eq(schema.connections.id, connectionId));
  await publishConnectionRemove(boardId, connectionId);
  return c.json({ ok: true });
});
