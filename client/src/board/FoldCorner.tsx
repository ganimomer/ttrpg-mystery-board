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
      <div className="fold-well" aria-hidden style={{ width: OPEN, height: OPEN }}>
        <span className="fold-icon">
          {revealed ? <VisibilityIcon size={18} /> : <VisibilityOffIcon size={18} />}
        </span>
      </div>
      <div
        className="fold-flap"
        aria-hidden
        style={{ width: fold, height: fold }}
      />
      <button
        type="button"
        className="fold-hit"
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
