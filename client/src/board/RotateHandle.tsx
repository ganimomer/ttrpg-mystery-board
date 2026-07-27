import { useRef, useState } from "react";
import { RotateIcon } from "./icons";

/** The tilt a GM may give a card. The server itself allows ±45. */
export const MIN_TILT = -15;
export const MAX_TILT = 15;

const clamp = (deg: number) => Math.min(MAX_TILT, Math.max(MIN_TILT, Math.round(deg)));

interface Props {
  rotation: number;
  /** The card being turned: the centre of its box is the pivot. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Called on every move, then once more with `commit` on release. */
  onTilt: (rotation: number, commit: boolean) => void;
}

/**
 * The little rotate arrow off a card's top-left corner. Drag it and the card
 * turns with your hand; a pill shows the angle while you hold it.
 *
 * The pivot is the target's bounding-box centre, which a rotation leaves where
 * it was, and the gesture is an angle *delta* — so the same maths serves a card
 * on the board at any zoom and a card held up close in the focus view.
 *
 * The wrapper around the grip is a hit target in its own right — a bridge that
 * stays live while the handle is hidden; see the note on `.rotate-handle` in
 * styles.css for why the handle is unreachable without it.
 */
export function RotateHandle({ rotation, targetRef, onTilt }: Props) {
  const drag = useRef<{
    pointerId: number;
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);

  /** Angle of the pointer about the card's centre, in degrees. */
  function angleAt(e: React.PointerEvent): number | null {
    const el = targetRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const dy = e.clientY - (r.top + r.height / 2);
    const dx = e.clientX - (r.left + r.width / 2);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  function onPointerDown(e: React.PointerEvent) {
    const angle = angleAt(e);
    if (angle === null) return;
    // The card underneath must not read this as a drag or a click.
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, startAngle: angle, startRotation: rotation };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const angle = angleAt(e);
    if (angle === null) return;
    // atan2 wraps at ±180°; take the short way round.
    let delta = angle - d.startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    onTilt(clamp(d.startRotation + delta), false);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    // One write for the whole gesture, like dropping a dragged card.
    onTilt(rotation, true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? -1
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? 1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    onTilt(clamp(rotation + step), true);
  }

  const showing = dragging || focused;

  return (
    <div className={`rotate-handle ${showing ? "is-active" : ""}`}>
      <button
        type="button"
        className="rotate-grip"
        role="slider"
        aria-label="Tilt"
        aria-valuenow={rotation}
        aria-valuemin={MIN_TILT}
        aria-valuemax={MAX_TILT}
        aria-valuetext={`${rotation} degrees`}
        title="Drag to tilt"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        /* Only a keyboard visit shows the pill — a press already shows it via
           `dragging`, and it should not hang around after the mouse is let go. */
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <RotateIcon size={18} />
      </button>
      {showing && <span className="tilt-pill">{rotation}°</span>}
    </div>
  );
}
