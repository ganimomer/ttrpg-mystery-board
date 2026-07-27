import styled, { css } from "styled-components";
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
    <StyledMiniCard
      type="button"
      $hidden={!card.revealed}
      title={card.title || "Untitled card"}
      aria-label={`Open ${card.title || "untitled card"}`}
      onClick={() => onOpen(card.id)}
    >
      <StyledMiniCardPaper style={{ width: CARD_WIDTH, transform: `scale(${SCALE})` }}>
        <CardFace card={card} />
      </StyledMiniCardPaper>
    </StyledMiniCard>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* A card drawn small is the card itself under a transform, so it keeps its own
   stock, tear and handwriting. The box is fixed so rows of them line up; a sheet
   taller than the box fades off the bottom rather than being cut. */
const StyledMiniCard = styled.button<{ $hidden: boolean }>`
  position: relative;
  flex: none;
  /* Matches MINI_WIDTH; the height is the polaroid's 280 at the same scale. */
  width: 104px;
  height: 132px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  overflow: hidden;
  border-radius: 3px;
  transition: transform 0.12s ease, filter 0.12s ease;
  mask-image: linear-gradient(to bottom, #000 82%, transparent 100%);

  &:hover {
    transform: translateY(-3px);
    filter: brightness(1.06);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  ${(p) =>
    p.$hidden &&
    css`
      opacity: 0.55;
      filter: grayscale(0.4);
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* The card at full size; only the transform makes it small, so nothing about
   the paper has to know it is being shrunk. */
const StyledMiniCardPaper = styled.span`
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  pointer-events: none;
`;
