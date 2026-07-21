import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { User } from "@board/shared";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import type { AppEnv } from "../types.js";

const COOKIE = "session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function setSession(c: Context, userId: string): Promise<void> {
  await setSignedCookie(c, COOKIE, userId, config.sessionSecret, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export function clearSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: "/" });
}

async function getSessionUser(c: Context): Promise<User | null> {
  const userId = await getSignedCookie(c, config.sessionSecret, COOKIE);
  if (!userId) return null;
  const row = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!row) return null;
  return { id: row.id, username: row.username, avatar: row.avatar };
}

/** Populates c.var.user or returns 401. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Not authenticated" }, 401);
  c.set("user", user);
  await next();
};

/** Populates c.var.user if present, but never blocks. */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await getSessionUser(c);
  if (user) c.set("user", user);
  await next();
};
