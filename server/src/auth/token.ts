import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

// A compact signed session token: `${userId}.${expMs}.${sig}` (base64url sig).
// One HMAC scheme reused for both the session cookie and the Activity's Bearer
// token, so the same value authenticates a request however it arrives.

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", config.sessionSecret).update(payload).digest());
}

export function signSession(
  userId: string,
  ttlMs: number = THIRTY_DAYS_MS,
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const sep = payload.lastIndexOf(".");
  if (sep <= 0) return null;
  const userId = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return userId;
}
