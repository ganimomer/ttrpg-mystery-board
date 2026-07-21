import { setToken } from "../auth/token";

/**
 * We're running inside Discord when the iframe URL carries a `frame_id` query
 * param (Discord injects it). In a normal browser this is absent and the app
 * uses the standalone Discord-login + cookie flow instead.
 */
export function isEmbedded(): boolean {
  return new URLSearchParams(window.location.search).has("frame_id");
}

let authPromise: Promise<void> | null = null;

/**
 * Authenticate the Discord Activity: init the Embedded App SDK, run the OAuth2
 * authorize flow, exchange the code on our backend for a session token, and
 * authenticate the SDK. Idempotent — safe to await more than once.
 */
export function initActivityAuth(): Promise<void> {
  if (!authPromise) authPromise = runActivityAuth();
  return authPromise;
}

async function runActivityAuth(): Promise<void> {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "VITE_DISCORD_CLIENT_ID is not set — cannot start the Discord Activity.",
    );
  }

  const { DiscordSDK } = await import("@discord/embedded-app-sdk");
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  // Step 1: get an authorization code from Discord.
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  // Step 2: exchange the code on our backend for an access token + our own
  // session token (the backend holds the client secret).
  const res = await fetch("/api/auth/discord/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error("Discord token exchange failed");
  const data = (await res.json()) as { access_token: string; token: string };

  setToken(data.token);

  // Step 3: authenticate the SDK so it can issue further RPC commands.
  await sdk.commands.authenticate({ access_token: data.access_token });
}
