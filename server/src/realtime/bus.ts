import type { BoardEvent, Card, Connection, Role } from "@board/shared";
import { shapeCardForRole } from "../reveal.js";

interface Subscriber {
  role: Role;
  send: (event: BoardEvent) => void;
}

// boardId -> set of live subscribers
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
 * Reveal-aware broadcast of a card upsert. The GM sees the real state; a
 * player receives the card only if it is revealed, otherwise a `removed`
 * event so a previously-revealed-now-hidden card disappears from their board.
 */
export function publishCardUpsert(card: Card): void {
  fanout(card.boardId, (sub) => {
    if (sub.role === "gm") return { type: "card.upserted", card };
    // Players get the card (notepad stripped of un-revealed tidbits) only while
    // it is revealed; otherwise a removal so a now-hidden card disappears.
    if (card.revealed) {
      return { type: "card.upserted", card: shapeCardForRole(card, "player") };
    }
    return { type: "card.removed", cardId: card.id };
  });
}

export function publishCardRemove(boardId: string, cardId: string): void {
  fanout(boardId, () => ({ type: "card.removed", cardId }));
}

export function publishConnectionUpsert(connection: Connection): void {
  fanout(connection.boardId, (sub) => {
    if (sub.role === "gm" || connection.revealed) {
      return { type: "connection.upserted", connection };
    }
    return { type: "connection.removed", connectionId: connection.id };
  });
}

export function publishConnectionRemove(
  boardId: string,
  connectionId: string,
): void {
  fanout(boardId, () => ({ type: "connection.removed", connectionId }));
}

export function publishBoardRenamed(boardId: string, name: string): void {
  fanout(boardId, () => ({ type: "board.renamed", name }));
}
