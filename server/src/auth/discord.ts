import { Hono } from "hono";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import type { Me } from "@board/shared";
import { config, isGameMaster } from "../config.js";
import { db, schema } from "../db/index.js";
import type { AppEnv } from "../types.js";
import { clearSession, requireAuth, setSession } from "./session.js";

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";
const STATE_COOKIE = "oauth_state";

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

  // Exchange code → access token.
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.discord.redirectUri,
    }),
  });
  if (!tokenRes.ok) return c.redirect(`${config.appOrigin}/?error=token`);
  const token = (await tokenRes.json()) as { access_token: string };

  // Fetch the Discord profile.
  const userRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) return c.redirect(`${config.appOrigin}/?error=profile`);
  const profile = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
  };

  // Upsert the user record.
  const username = profile.global_name || profile.username;
  db.insert(schema.users)
    .values({ id: profile.id, username, avatar: profile.avatar })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { username, avatar: profile.avatar },
    })
    .run();

  await setSession(c, profile.id);
  return c.redirect(`${config.appOrigin}/`);
});

authRoutes.post("/logout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  const me: Me = { user, isGameMaster: isGameMaster(user.id) };
  return c.json(me);
});
