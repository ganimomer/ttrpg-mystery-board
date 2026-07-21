import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Board, BoardSnapshot, Invite } from "@board/shared";
import { getMembership, requireBoardGM, requireBoardMember } from "../access.js";
import { config, isGameMaster } from "../config.js";
import { db, schema } from "../db/index.js";
import { toCard, toConnection } from "../mappers.js";
import { visibleCards, visibleConnections } from "../reveal.js";
import { publishBoardRenamed } from "../realtime/bus.js";
import { requireAuth } from "../auth/session.js";
import type { AppEnv } from "../types.js";

export const boardsRoutes = new Hono<AppEnv>();
boardsRoutes.use("*", requireAuth);

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Create a board (global GMs only).
boardsRoutes.post("/", async (c) => {
  const user = c.get("user");
  if (!isGameMaster(user.id)) {
    return c.json({ error: "Only a Game Master can create boards" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ name: z.string().trim().min(1).max(120) })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid board name" }, 400);

  const id = nanoid();
  db.insert(schema.boards)
    .values({ id, name: parsed.data.name, ownerId: user.id })
    .run();
  db.insert(schema.boardMembers)
    .values({ boardId: id, userId: user.id, role: "gm" })
    .run();

  const board: Board = { id, name: parsed.data.name, ownerId: user.id, role: "gm" };
  return c.json(board, 201);
});

// List boards the current user belongs to.
boardsRoutes.get("/", (c) => {
  const user = c.get("user");
  const rows = db
    .select({
      id: schema.boards.id,
      name: schema.boards.name,
      ownerId: schema.boards.ownerId,
      role: schema.boardMembers.role,
    })
    .from(schema.boardMembers)
    .innerJoin(schema.boards, eq(schema.boards.id, schema.boardMembers.boardId))
    .where(eq(schema.boardMembers.userId, user.id))
    .all();
  const boards: Board[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.ownerId,
    role: r.role,
  }));
  return c.json(boards);
});

// Full snapshot of a board, reveal-filtered for players.
boardsRoutes.get("/:boardId", requireBoardMember, (c) => {
  const boardId = c.get("boardId");
  const role = c.get("role");
  const boardRow = db
    .select()
    .from(schema.boards)
    .where(eq(schema.boards.id, boardId))
    .get()!;

  const allCards = db
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.boardId, boardId))
    .all()
    .map(toCard);
  const allConnections = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.boardId, boardId))
    .all()
    .map(toConnection);

  // Players never receive hidden items — enforced here, server-side.
  const cards = visibleCards(allCards, role);
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
  db.update(schema.boards)
    .set({ name: parsed.data.name })
    .where(eq(schema.boards.id, boardId))
    .run();
  publishBoardRenamed(boardId, parsed.data.name);
  return c.json({ ok: true });
});

// Generate an invite link (GM only).
boardsRoutes.post(
  "/:boardId/invites",
  requireBoardMember,
  requireBoardGM,
  (c) => {
    const boardId = c.get("boardId");
    const user = c.get("user");
    const token = nanoid(24);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    db.insert(schema.invites)
      .values({ token, boardId, createdBy: user.id, expiresAt })
      .run();
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
invitesRoutes.post("/:token/redeem", (c) => {
  const token = c.req.param("token");
  const user = c.get("user");
  const invite = db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.token, token))
    .get();
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    return c.json({ error: "This invite is invalid or has expired" }, 404);
  }
  // Idempotent: already a member? just return the board id.
  const existing = getMembership(invite.boardId, user.id);
  if (!existing) {
    db.insert(schema.boardMembers)
      .values({ boardId: invite.boardId, userId: user.id, role: "player" })
      .onConflictDoNothing()
      .run();
  }
  return c.json({ boardId: invite.boardId });
});
