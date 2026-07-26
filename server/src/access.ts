import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { Role } from "@board/shared";
import { db, schema } from "./db/index.js";
import type { AppEnv } from "./types.js";

export function getMembership(boardId: string, userId: string): Role | null {
  const row = db
    .select({ role: schema.boardMembers.role })
    .from(schema.boardMembers)
    .where(
      and(
        eq(schema.boardMembers.boardId, boardId),
        eq(schema.boardMembers.userId, userId),
      ),
    )
    .get();
  return row?.role ?? null;
}

/**
 * Guards routes mounted under `/boards/:boardId`. Requires an authenticated
 * user (via requireAuth upstream) who is a member of the board. Populates
 * `boardId` and `role` in the context.
 */
export const requireBoardMember: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const boardId = c.req.param("boardId");
  if (!boardId) return c.json({ error: "Board not specified" }, 400);
  const user = c.get("user");
  const role = getMembership(boardId, user.id);
  if (!role) return c.json({ error: "Not a member of this board" }, 403);
  c.set("boardId", boardId);
  c.set("role", role);
  await next();
};

/** Further restricts a board route to the GM. */
export const requireBoardGM: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("role") !== "gm") {
    return c.json({ error: "Only the Game Master can do this" }, 403);
  }
  await next();
};
