import styled from "styled-components";
import { VisibilityIcon, VisibilityOffIcon } from "./icons";

/**
 * The dog-eared corner of a focused card: the GM's reveal control.
 *
 * Three pieces, in paper order. The *well* is the shadowed underside, a fixed
 * square behind the sheet holding the show/hide icon — the parent's clip-path
 * cuts the corner off the sheet, and whatever the cut uncovers is what you see.
 * The *flap* is the turned-over corner itself, mirrored across the crease. The
 * *hit* is the invisible corner triangle you point at.
 *
 * Nothing here fades: the icon is simply behind the paper and the fold uncovers
 * it, which is also why a card hidden from the players rests turned up a little
 * further — the crossed-out eye peeks out on its own.
 */

/** Fold depth in px. The parent needs it too, for the sheet's clip-path. */
const REST = 30;
const REST_HIDDEN = 42;
const OPEN = 64;

export function foldSize(revealed: boolean, open: boolean): number {
  if (open) return OPEN;
  return revealed ? REST : REST_HIDDEN;
}

interface Props {
  fold: number;
  revealed: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
}

export function FoldCorner({ fold, revealed, onOpenChange, onToggle }: Props) {
  return (
    <>
      {/* Sized to the fully open fold so the icon holds still while the corner
          turns; the paper above it is what hides and uncovers it. */}
      <StyledFoldWell aria-hidden style={{ width: OPEN, height: OPEN }}>
        <StyledFoldIcon>
          {revealed ? <VisibilityIcon size={18} /> : <VisibilityOffIcon size={18} />}
        </StyledFoldIcon>
      </StyledFoldWell>
      <StyledFoldFlap aria-hidden style={{ width: fold, height: fold }} />
      <StyledFoldHit
        type="button"
        aria-label={revealed ? "Hide from players" : "Show to players"}
        aria-pressed={revealed}
        title={
          revealed
            ? "Players can see this — click to hide it"
            : "Hidden from players — click to show it"
        }
        onPointerEnter={() => onOpenChange(true)}
        onPointerLeave={() => onOpenChange(false)}
        onFocus={() => onOpenChange(true)}
        onBlur={() => onOpenChange(false)}
        onClick={onToggle}
      />
    </>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* The well is the shadowed underside the fold uncovers — it never moves, so the
   icon in it holds still while the corner turns. */
const StyledFoldWell = styled.div`
  position: absolute;
  z-index: 0;
  top: 0;
  right: 0;
  background: linear-gradient(225deg, #4d4029, #221a12 78%);
`;

const StyledFoldIcon = styled.span`
  position: absolute;
  top: 7px;
  right: 7px;
  /* Pale, because what it lies on is the shadowed underside of the paper. */
  color: #f0e2c4;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6));
`;

/* The corner itself, mirrored across the crease: a box whose triangle spans
   (100%-fold, 0) → (100%, fold) → (100%-fold, fold), which is where folded
   paper actually lands. */
const StyledFoldFlap = styled.div`
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  pointer-events: none;
  clip-path: polygon(0 0, 100% 100%, 0 100%);
  /* The crease runs down the middle of this box, so the shading has to start at
     50% — anything earlier lands on the half that is clipped away. */
  background:
    linear-gradient(
      225deg,
      rgba(90, 74, 46, 0) 48%,
      rgba(90, 74, 46, 0.42) 53%,
      rgba(90, 74, 46, 0.06) 100%
    ),
    #f7f0de;
  transition: width 180ms ease, height 180ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* Pointing at the hit peels the fold further open, and that movement is also the
   keyboard focus indicator — an outline would be clipped away with the
   triangle. */
const StyledFoldHit = styled.button`
  position: absolute;
  z-index: 4;
  top: 0;
  right: 0;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  /* Only the corner triangle is live, so it can't swallow the photo's own
     buttons sitting just inside it. */
  clip-path: polygon(0 0, 100% 0, 100% 100%);
`;
