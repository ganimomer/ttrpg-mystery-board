import type { BoardEvent, Card, Connection, Role } from "@board/shared";
import { shapeCardForRole } from "../reveal.js";

// Per-instance registry of live SSE subscribers. Cross-instance fan-out is
// handled by the Postgres LISTEN/NOTIFY bus (bus.ts), which calls the
// deliver* functions below on every instance. This module is DB-free and pure,
// so the role-shaping is unit-testable offline.

interface Subscriber {
  role: Role;
  send: (event: BoardEvent) => void;
}

// boardId -> set of live subscribers on THIS instance
const rooms = new Map<string, Set<Subscriber>>();

export function subscribe(boardId: string, sub: Subscriber): () => void {
  let set = rooms.get(boardId);
  if (!set) {
    set = new Set();
    rooms.set(boardId, set);
  }
  set.add(sub);
  return () => {
    set!.delete(sub);
    if (set!.size === 0) rooms.delete(boardId);
  };
}

function fanout(boardId: string, forRole: (sub: Subscriber) => BoardEvent | null) {
  const set = rooms.get(boardId);
  if (!set) return;
  for (const sub of set) {
    const event = forRole(sub);
    if (event) sub.send(event);
  }
}

/**
 * Reveal-aware delivery of a card upsert to local subscribers. The GM sees the
 * real state; a player receives the card (notepad stripped of un-revealed
 * tidbits) only while it is revealed, otherwise a `removed` event so a
 * now-hidden card disappears from their board.
 *
 * `groupVisible` is the caller's answer to "is this card's group revealed?" — a
 * player is never told which group a card belongs to unless they can see the
 * group's own card, the same rule `stripHiddenGroups` applies to the snapshot.
 */
export function deliverCardUpsert(card: Card, groupVisible = true): void {
  fanout(card.boardId, (sub) => {
    if (sub.role === "gm") return { type: "card.upserted", card };
    if (card.revealed) {
      const shaped = shapeCardForRole(card, "player");
      return {
        type: "card.upserted",
        card: groupVisible ? shaped : { ...shaped, groupId: null },
      };
    }
    return { type: "card.removed", cardId: card.id };
  });
}

export function deliverCardRemove(boardId: string, cardId: string): void {
  fanout(boardId, () => ({ type: "card.removed", cardId }));
}

export function deliverConnectionUpsert(connection: Connection): void {
  fanout(connection.boardId, (sub) => {
    if (sub.role === "gm" || connection.revealed) {
      return { type: "connection.upserted", connection };
    }
    return { type: "connection.removed", connectionId: connection.id };
  });
}

export function deliverConnectionRemove(
  boardId: string,
  connectionId: string,
): void {
  fanout(boardId, () => ({ type: "connection.removed", connectionId }));
}

export function deliverBoardRenamed(boardId: string, name: string): void {
  fanout(boardId, () => ({ type: "board.renamed", name }));
}
