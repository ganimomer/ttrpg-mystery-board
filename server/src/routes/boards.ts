import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Board, BoardSnapshot, Invite, Tidbit } from "@board/shared";
import { getMembership, requireBoardGM, requireBoardMember } from "../access.js";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import { toCard, toConnection, toTidbit } from "../mappers.js";
import {
  shapeCardForRole,
  stripHiddenGroups,
  visibleCards,
  visibleConnections,
} from "../reveal.js";
import { publishBoardRenamed } from "../realtime/bus.js";
import { requireAuth } from "../auth/session.js";
import type { AppEnv } from "../types.js";

export const boardsRoutes = new Hono<AppEnv>();
boardsRoutes.use("*", requireAuth);

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Create a board. Any signed-in user may — they become its owner + GM.
boardsRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ name: z.string().trim().min(1).max(120) })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid board name" }, 400);

  const id = nanoid();
  await db
    .insert(schema.boards)
    .values({ id, name: parsed.data.name, ownerId: user.id });
  await db
    .insert(schema.boardMembers)
    .values({ boardId: id, userId: user.id, role: "gm" });

  const board: Board = { id, name: parsed.data.name, ownerId: user.id, role: "gm" };
  return c.json(board, 201);
});

// List boards the current user belongs to.
boardsRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select({
      id: schema.boards.id,
      name: schema.boards.name,
      ownerId: schema.boards.ownerId,
      role: schema.boardMembers.role,
    })
    .from(schema.boardMembers)
    .innerJoin(schema.boards, eq(schema.boards.id, schema.boardMembers.boardId))
    .where(eq(schema.boardMembers.userId, user.id));
  const boards: Board[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.ownerId,
    role: r.role,
  }));
  return c.json(boards);
});

// Full snapshot of a board, reveal-filtered for players.
boardsRoutes.get("/:boardId", requireBoardMember, async (c) => {
  const boardId = c.get("boardId");
  const role = c.get("role");
  const [boardRow] = await db
    .select()
    .from(schema.boards)
    .where(eq(schema.boards.id, boardId))
    .limit(1);

  // Batch-load tidbits for the whole board and group them by card.
  const notesByCard = new Map<string, Tidbit[]>();
  const noteRows = await db
    .select()
    .from(schema.noteItems)
    .where(eq(schema.noteItems.boardId, boardId))
    .orderBy(asc(schema.noteItems.position));
  for (const row of noteRows) {
    const list = notesByCard.get(row.cardId) ?? [];
    list.push(toTidbit(row));
    notesByCard.set(row.cardId, list);
  }

  const cardRows = await db
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.boardId, boardId));
  const allCards = cardRows.map((row) => toCard(row, notesByCard.get(row.id) ?? []));
  const connRows = await db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.boardId, boardId));
  const allConnections = connRows.map(toConnection);

  // Players never receive hidden items — enforced here, server-side. Cards are
  // additionally shaped so un-revealed tidbit text is stripped from the notepad,
  // and membership of a group they cannot see is stripped with it.
  const cards = stripHiddenGroups(
    visibleCards(allCards, role).map((c) => shapeCardForRole(c, role)),
    role,
  );
  const visibleIds = new Set(cards.map((c) => c.id));
  const connections = visibleConnections(allConnections, visibleIds, role);

  const snapshot: BoardSnapshot = {
    board: {
      id: boardRow.id,
      name: boardRow.name,
      ownerId: boardRow.ownerId,
      role,
    },
    cards,
    connections,
  };
  return c.json(snapshot);
});

// Rename a board (GM only).
boardsRoutes.patch("/:boardId", requireBoardMember, requireBoardGM, async (c) => {
  const boardId = c.get("boardId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ name: z.string().trim().min(1).max(120) })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid board name" }, 400);
  await db
    .update(schema.boards)
    .set({ name: parsed.data.name })
    .where(eq(schema.boards.id, boardId));
  await publishBoardRenamed(boardId, parsed.data.name);
  return c.json({ ok: true });
});

// Generate an invite link (GM only).
boardsRoutes.post(
  "/:boardId/invites",
  requireBoardMember,
  requireBoardGM,
  async (c) => {
    const boardId = c.get("boardId");
    const user = c.get("user");
    const token = nanoid(24);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await db
      .insert(schema.invites)
      .values({ token, boardId, createdBy: user.id, expiresAt });
    const invite: Invite = {
      token,
      boardId,
      url: `${config.appOrigin}/join/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
    return c.json(invite, 201);
  },
);

// Redeem an invite: join the board as a player.
export const invitesRoutes = new Hono<AppEnv>();
invitesRoutes.use("*", requireAuth);
invitesRoutes.post("/:token/redeem", async (c) => {
  const token = c.req.param("token");
  const user = c.get("user");
  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.token, token))
    .limit(1);
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    return c.json({ error: "This invite is invalid or has expired" }, 404);
  }
  // Idempotent: already a member? just return the board id.
  const existing = await getMembership(invite.boardId, user.id);
  if (!existing) {
    await db
      .insert(schema.boardMembers)
      .values({ boardId: invite.boardId, userId: user.id, role: "player" })
      .onConflictDoNothing();
  }
  return c.json({ boardId: invite.boardId });
});
