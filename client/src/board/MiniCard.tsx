import type { Card } from "@board/shared";
import { CardFace } from "./CardFace";
import { CARD_WIDTH } from "./layout";

/**
 * Box a mini fits in. The paper inside is a real card, scaled to match — big
 * enough that a title is still readable at this size, which is what stops a row
 * of them being a row of anonymous rectangles.
 */
export const MINI_WIDTH = 104;
const SCALE = MINI_WIDTH / CARD_WIDTH;

interface Props {
  card: Card;
  onOpen: (id: string) => void;
}

/**
 * A card drawn small — the same paper, the same tear, the same handwriting, at
 * `SCALE`. Pressing one moves the focus view to that card.
 *
 * Upright, unlike its full-size self: the tilt belongs to a card pinned to cork,
 * not to a row of them in a tray. A long sheet overflows the box and is faded
 * off at the bottom rather than cut, so the clip reads as deliberate.
 */
export function MiniCard({ card, onOpen }: Props) {
  return (
    <button
      type="button"
      className={`mini-card ${card.revealed ? "" : "is-hidden"}`}
      title={card.title || "Untitled card"}
      aria-label={`Open ${card.title || "untitled card"}`}
      onClick={() => onOpen(card.id)}
    >
      <span
        className="mini-card-paper"
        style={{ width: CARD_WIDTH, transform: `scale(${SCALE})` }}
      >
        <CardFace card={card} />
      </span>
    </button>
  );
}
