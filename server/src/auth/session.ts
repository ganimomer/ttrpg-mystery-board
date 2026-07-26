import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { User } from "@board/shared";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import type { AppEnv } from "../types.js";
import { signSession, verifySession } from "./token.js";

const COOKIE = "session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function setSession(c: Context, userId: string): void {
  setCookie(c, COOKIE, signSession(userId), {
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

/**
 * Resolve the signed session token from, in order: an `Authorization: Bearer`
 * header (Discord Activity / any header-capable client), a `?token=` query
 * param (for `<img>` and `EventSource`, which can't set headers), or the
 * session cookie (standalone browser). All three carry the same signed value.
 */
function readToken(c: Context): string | null {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const q = c.req.query("token");
  if (q) return q;
  return getCookie(c, COOKIE) ?? null;
}

async function getSessionUser(c: Context): Promise<User | null> {
  const userId = verifySession(readToken(c));
  if (!userId) return null;
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
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
