import type { Card, Connection } from "@board/shared";
import { loadCardWithNotepad, loadConnection } from "../cards.js";
import { sql } from "../db/index.js";
import {
  deliverBoardRenamed,
  deliverCardRemove,
  deliverCardUpsert,
  deliverConnectionRemove,
  deliverConnectionUpsert,
} from "./subscribers.js";

// Cross-instance event bus over Postgres LISTEN/NOTIFY. Publishers emit a tiny
// *pointer* (never content) on the `board_events` channel; every instance —
// including the origin — receives it, re-reads the entity, and delivers a
// role-shaped event to its own SSE subscribers. Keeping content off the wire
// stays well under NOTIFY's ~8 KB limit and preserves the reveal invariant
// (hidden data is only ever filtered in per-subscriber, before it reaches a
// browser).

const CHANNEL = "board_events";

type Pointer =
  | { t: "card"; boardId: string; id: string }
  | { t: "card_rm"; boardId: string; id: string }
  | { t: "conn"; boardId: string; id: string }
  | { t: "conn_rm"; boardId: string; id: string }
  | { t: "board_rename"; boardId: string; name: string };

async function notify(p: Pointer): Promise<void> {
  await sql.notify(CHANNEL, JSON.stringify(p));
}

export function publishCardUpsert(card: Card): Promise<void> {
  return notify({ t: "card", boardId: card.boardId, id: card.id });
}

export function publishCardRemove(boardId: string, cardId: string): Promise<void> {
  return notify({ t: "card_rm", boardId, id: cardId });
}

export function publishConnectionUpsert(connection: Connection): Promise<void> {
  return notify({ t: "conn", boardId: connection.boardId, id: connection.id });
}

export function publishConnectionRemove(
  boardId: string,
  connectionId: string,
): Promise<void> {
  return notify({ t: "conn_rm", boardId, id: connectionId });
}

export function publishBoardRenamed(boardId: string, name: string): Promise<void> {
  return notify({ t: "board_rename", boardId, name });
}

async function handle(p: Pointer): Promise<void> {
  switch (p.t) {
    case "card": {
      const card = await loadCardWithNotepad(p.id);
      if (!card) {
        deliverCardRemove(p.boardId, p.id); // deleted meanwhile
        break;
      }
      // Whether a player may be told this card is in a group depends on the
      // group's card, which only the database knows about here.
      const group = card.groupId ? await loadCardWithNotepad(card.groupId) : null;
      deliverCardUpsert(card, !card.groupId || !!group?.revealed);
      break;
    }
    case "card_rm":
      deliverCardRemove(p.boardId, p.id);
      break;
    case "conn": {
      const conn = await loadConnection(p.id);
      if (conn) deliverConnectionUpsert(conn);
      else deliverConnectionRemove(p.boardId, p.id);
      break;
    }
    case "conn_rm":
      deliverConnectionRemove(p.boardId, p.id);
      break;
    case "board_rename":
      deliverBoardRenamed(p.boardId, p.name);
      break;
  }
}

/** Begin listening for board events. Call once at server boot. */
export async function startListening(): Promise<void> {
  await sql.listen(CHANNEL, (payload) => {
    try {
      void handle(JSON.parse(payload) as Pointer);
    } catch (err) {
      console.error("Bad board_events payload:", err);
    }
  });
}
