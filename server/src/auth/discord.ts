import { Hono } from "hono";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import type { Me } from "@board/shared";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import type { AppEnv } from "../types.js";
import { clearSession, requireAuth, setSession } from "./session.js";
import { signSession } from "./token.js";

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";
const STATE_COOKIE = "oauth_state";

interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
}

// Exchange an OAuth2 authorization code for an access token. The redirect flow
// passes its redirect_uri; the Activity (Embedded SDK) flow omits it. Returns
// the access token, or null on a failed exchange.
async function exchangeCode(
  code: string,
  redirectUri?: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: "authorization_code",
    code,
  });
  if (redirectUri) params.set("redirect_uri", redirectUri);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) return null;
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token ?? null;
}

// Fetch the Discord profile for an access token and upsert our user record.
async function upsertDiscordUser(accessToken: string): Promise<Me | null> {
  const userRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const profile = (await userRes.json()) as DiscordProfile;
  const username = profile.global_name || profile.username;
  await db
    .insert(schema.users)
    .values({ id: profile.id, username, avatar: profile.avatar })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { username, avatar: profile.avatar },
    });
  return { user: { id: profile.id, username, avatar: profile.avatar } };
}

export const authRoutes = new Hono<AppEnv>();

// Step 1: send the user to Discord.
authRoutes.get("/discord", async (c) => {
  const state = nanoid();
  await setSignedCookie(c, STATE_COOKIE, state, config.sessionSecret, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.discord.clientId);
  url.searchParams.set("redirect_uri", config.discord.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

// Step 2: Discord redirects back with a code.
authRoutes.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = await getSignedCookie(
    c,
    config.sessionSecret,
    STATE_COOKIE,
  );
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !expectedState || state !== expectedState) {
    return c.redirect(`${config.appOrigin}/?error=auth`);
  }

  const accessToken = await exchangeCode(code, config.discord.redirectUri);
  if (!accessToken) return c.redirect(`${config.appOrigin}/?error=token`);

  const me = await upsertDiscordUser(accessToken);
  if (!me) return c.redirect(`${config.appOrigin}/?error=profile`);

  setSession(c, me.user.id);
  return c.redirect(`${config.appOrigin}/`);
});

// Discord Activity token exchange. The Embedded App SDK gives the client an
// authorization `code`; we swap it for an access token (no redirect_uri for
// activities), upsert the user, and mint our own Bearer session token. The
// client also needs `access_token` back to call `commands.authenticate`.
authRoutes.post("/discord/token", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) return c.json({ error: "Missing code" }, 400);

  const accessToken = await exchangeCode(body.code);
  if (!accessToken) return c.json({ error: "Token exchange failed" }, 401);

  const me = await upsertDiscordUser(accessToken);
  if (!me) return c.json({ error: "Could not read Discord profile" }, 401);

  return c.json({
    access_token: accessToken,
    token: signSession(me.user.id),
    user: me.user,
  });
});

authRoutes.post("/logout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  const me: Me = { user };
  return c.json(me);
});
