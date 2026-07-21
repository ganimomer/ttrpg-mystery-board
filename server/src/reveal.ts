import type { Card, Connection, Role } from "@board/shared";

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
