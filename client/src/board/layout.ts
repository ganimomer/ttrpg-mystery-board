import type { Card } from "@board/shared";

// Board-space dimensions shared by cards and the string layer.
export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 280;

// The tack sits near the top-center; strings anchor to it.
export function tackAnchor(x: number, y: number): { x: number; y: number } {
  return { x: x + CARD_WIDTH / 2, y: y + 14 };
}

// ─── Groups ───────────────────────────────────────────────────────
// A card carrying a frame is a group: it wears a nameplate at the top of a
// dotted rectangle, and the cards sitting inside that rectangle belong to it.

/** How far the nameplate card overhangs the frame's top edge. Fixed, not a
 *  fraction of the card's height: a note sheet grows with its text, and the
 *  frame must not shift while someone is typing. */
export const PLATE_OVERHANG = 64;

export const FRAME_DEFAULT = { width: 560, height: 420 };
export const FRAME_MIN = { width: 320, height: 260 };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The dotted rectangle of a group card, in board coordinates. Derived from the
 *  card's own position, so dragging the card moves the frame with it. */
export function frameRect(card: Card): Rect | null {
  if (!card.frame) return null;
  return {
    x: Math.round(card.x + CARD_WIDTH / 2 - card.frame.width / 2),
    y: card.y + PLATE_OVERHANG,
    width: card.frame.width,
    height: card.frame.height,
  };
}

function contains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/**
 * Which group a point falls into — the id of the group card, or null for open
 * cork. The smallest frame wins, so a frame drawn inside another takes the card.
 * Group cards themselves never join a group (no nesting).
 */
export function groupAt(
  x: number,
  y: number,
  cards: Card[],
  exclude?: string,
): string | null {
  let best: { id: string; area: number } | null = null;
  for (const card of cards) {
    if (card.id === exclude) continue;
    const rect = frameRect(card);
    if (!rect || !contains(rect, x, y)) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { id: card.id, area };
  }
  return best?.id ?? null;
}

/**
 * The point that decides which group a card is in: where it is pinned, a little
 * below its tack. Not the card's middle, because a torn sheet's height depends on
 * how much is written on it and membership must not — this point is inside the
 * paper for every kind of card.
 */
export function membershipPoint(card: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return { x: card.x + CARD_WIDTH / 2, y: card.y + 60 };
}
