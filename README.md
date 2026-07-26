# 🧵 The Mystery Board

A detective-style **cork board** for TTRPG campaigns. Pin concepts, NPCs and places
as **Polaroids** with handwritten notes, tie **strings** between them to show
relationships, and **reveal** clues to your players one at a time — live.

Built as a standalone web app now, and structured to later drop into a **Discord
Activity** with a thin wrapper.

> **Why it's private:** there is no public upload path. Only the authenticated Game
> Master can upload art; players can only view boards they've been invited to. This
> is a deliberate design choice to avoid hosting arbitrary user-uploaded images.

<!-- Screenshots live in the PR / your own docs; the app looks like a real cork board. -->

## How it works

- **Game Masters** (you) sign in with Discord, create boards, upload photos, add
  Polaroids, tie strings, and toggle each item between **hidden** and **revealed**.
- **Players** join via an invite link, sign in with Discord, and see only what's
  been revealed. Hidden cards and strings are **never sent to their browser** — the
  filtering is enforced on the server, both in the REST snapshot and the live feed.
- **Reveals are live**: when the GM flips a card to revealed, it appears on every
  connected player's board instantly over Server-Sent Events. No refresh.
- A GM can hit **Preview as player** to see exactly what the table sees.

## Tech

- **Monorepo** (npm workspaces): `shared/` (types), `server/` (Hono + SQLite), `client/` (Vite + React).
- **Server**: [Hono](https://hono.dev) on Node, SQLite via Drizzle ORM, `sharp` for
  image validation, SSE for live updates.
- **Client**: React + TypeScript, a DOM/SVG cork board (crisp handwriting, no canvas
  library), self-hosted Caveat font.
- **Auth**: Discord OAuth2, signed httpOnly session cookie.

## Prerequisites

- Node.js **20+**
- A Discord application (free): <https://discord.com/developers/applications>

## Setup

### 1. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Open **OAuth2** and copy the **Client ID** and **Client Secret**.
3. Under **OAuth2 → Redirects**, add:
   `http://localhost:8787/api/auth/discord/callback`
4. Find your own **Discord user ID**: enable *Settings → Advanced → Developer Mode*,
   then right-click your name → **Copy User ID**. This makes you the Game Master.

### 2. Configure the app

```bash
cp .env.example .env
# then edit .env and fill in:
#   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
#   GM_DISCORD_IDS   (your Discord user id; comma-separated for multiple GMs)
#   SESSION_SECRET   (a long random string — see the comment in .env.example)
```

### 3. Install & run (development)

```bash
npm install
npm run build --workspace shared   # build the shared types once
npm run dev                        # starts server (:8787) + client (:5173)
```

Open <http://localhost:5173>. Vite proxies `/api` to the server, so everything is
first-party (no CORS) and the same relative paths work in production and inside
Discord later.

> **Handwriting font:** a Latin subset of *Caveat* is bundled at
> `client/public/fonts/Caveat.woff2` (SIL Open Font License). Swap it for any
> handwriting font you like — the app falls back to a system cursive stack if the
> file is missing.

## Everyday use

1. Sign in with Discord. As a GM you'll see **Your Boards** and a create field.
2. Create a board, then **+ Polaroid** to drop a card. Select it to set a title,
   handwritten note, upload a photo, tilt it, and flip **Hidden ↔ Revealed**.
3. **Tie a string:** click a card's thumbtack, then another card's thumbtack. Select
   the string to label it, colour it, or reveal it.
4. **Notepad:** a card can carry a lined-yellow **notepad** of tidbits tucked under
   the Polaroid with its edge peeking out. Click the peek to pull it open; as GM add
   lines and reveal them individually (or hit **Reveal next**). A revealed tidbit
   jumps to the bottom of the revealed block, so players read them in reveal order —
   and un-revealed tidbit text never leaves the server.
5. **Invite players:** click **Invite players**, copy the link, share it. Players
   sign in with Discord and are added to that board as viewers.
6. During the session, select an item and hit the reveal toggle — it pops onto every
   player's board live.

## Production build

```bash
npm run build            # builds shared, server, and client
NODE_ENV=production npm start   # server serves the built client + API on :$PORT
```

Set the production env vars (`APP_ORIGIN`, `DISCORD_REDIRECT_URI` pointing at your
real domain, a strong `SESSION_SECRET`) and add the production redirect URL in the
Discord portal. Persist the `DATA_DIR` (SQLite db + uploaded images) on a real disk
or volume.

## Tests

```bash
npm test --workspace server
```

Covers the security-critical bits: reveal filtering (players never receive hidden
cards/connections, in the snapshot or the live bus) and image-upload validation.

## Project layout

```
shared/   Shared TypeScript types (Card, Connection, BoardEvent, …)
server/   Hono API — auth, boards, cards, connections, images, SSE
client/   React cork board — Board, Polaroid, StringLayer, Inspector
```

## Roadmap → Discord Activity

The app is already shaped for it: relative `/api` paths, no external CDN assets, and
auth behind a small provider. The later phase adds the `@discord/embedded-app-sdk`,
Discord URL mappings, and swaps the OAuth redirect for the SDK's in-iframe
authorization — reusing the same server-side token exchange.
