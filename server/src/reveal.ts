import type { Card, Connection, Role, Tidbit } from "@board/shared";

/**
 * The single source of truth for what a given role may see. Used by the REST
 * snapshot; the SSE bus enforces the same rule per-event. Keeping it pure makes
 * the security-critical behaviour directly testable.
 */
export function visibleCards(cards: Card[], role: Role): Card[] {
  if (role === "gm") return cards;
  return cards.filter((c) => c.revealed);
}

export function visibleConnections(
  connections: Connection[],
  visibleCardIds: Set<string>,
  role: Role,
): Connection[] {
  if (role === "gm") return connections;
  return connections.filter(
    (c) =>
      c.revealed &&
      visibleCardIds.has(c.fromCardId) &&
      visibleCardIds.has(c.toCardId),
  );
}

/** GM sees every tidbit; a player sees only revealed ones, in order. */
export function visibleTidbits(tidbits: Tidbit[], role: Role): Tidbit[] {
  if (role === "gm") return tidbits;
  return tidbits.filter((t) => t.revealed);
}

/**
 * Role-shape a full card for delivery. For players the notepad is stripped of
 * un-revealed tidbits so their text never leaves the server. Used by both the
 * REST snapshot and the SSE bus.
 */
export function shapeCardForRole(card: Card, role: Role): Card {
  if (role === "gm") return card;
  return { ...card, notepad: visibleTidbits(card.notepad, role) };
}

interface Orderable {
  id: string;
  revealed: boolean;
}

/**
 * Toggle `id`'s revealed state and re-slot it to the boundary between the
 * revealed block and the unrevealed block (the "first unrevealed slot"). With a
 * revealed-first invariant on the input, this keeps revealed tidbits contiguous
 * at the top in reveal order — so a newly revealed item lands at the bottom of
 * the revealed block, and a hidden one drops just below it. Pure; returns a new
 * array in the new order (positions are the array indices).
 */
export function reorderOnReveal<T extends Orderable>(
  items: T[],
  id: string,
  revealed: boolean,
): T[] {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const without = items.filter((i) => i.id !== id);
  const revealedCount = without.filter((i) => i.revealed).length;
  const result = [...without];
  result.splice(revealedCount, 0, { ...target, revealed });
  return result;
}
