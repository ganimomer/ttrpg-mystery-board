import { useRef, useState } from "react";
import styled, { css } from "styled-components";
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

  return (
    <StyledRotateHandle $dragging={dragging} data-nodrag>
      <StyledRotateGrip
        type="button"
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
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <RotateIcon size={18} />
      </StyledRotateGrip>
      {/* Redundant with the slider's own aria-valuetext, and never read aloud. */}
      <StyledTiltPill $dragging={dragging} aria-hidden>
        {rotation}°
      </StyledTiltPill>
    </StyledRotateHandle>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* The rotate arrow off a card's top-left corner. On a board card it waits until
   the card is under the pointer; on the focused card — the one card being worked
   on — it simply stays, arriving with the pad and the bin once the card lands.
   Both of those reveals belong to the ancestor, so `Card` and `CardFocus`
   interpolate this component and its grip into their own rules.

   The wrapper is always hit-testable, and it is the *grip* whose pointer-events
   are gated. That asymmetry is what makes the handle reachable at all: it sits
   outside the card's box, so if the whole handle went `pointer-events: none`
   while hidden, the pointer would cross ground belonging to neither the card nor
   the handle, lose `:hover`, and the handle would become untouchable exactly as
   you arrived at it — with no way to bring it back. Hovering the wrapper keeps
   the card's `:hover` true, since it is one of the card's own children, so the
   reveal holds from any direction. Nothing can be rotated by accident meanwhile:
   while the handle is hidden the wrapper is inert, and pressing it does nothing.
   It laps 4px over the card's corner as well, so the natural diagonal approach
   never even starts the fade. */
export const StyledRotateGrip = styled.button`
  position: absolute;
  top: 0;
  left: 0;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #2a2118;
  color: #f6e5c9;
  cursor: grab;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
  touch-action: none;
  pointer-events: none;

  &:active {
    cursor: grabbing;
    background: var(--accent);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

export const StyledRotateHandle = styled.div<{ $dragging: boolean }>`
  position: absolute;
  z-index: 6;
  top: -34px;
  left: -34px;
  width: 38px;
  height: 38px;
  opacity: 0;
  transition: opacity 120ms ease;

  &:focus-within {
    opacity: 1;
  }
  &:focus-within ${StyledRotateGrip} {
    pointer-events: auto;
  }

  ${(p) =>
    p.$dragging &&
    css`
      opacity: 1;
      ${StyledRotateGrip} {
        pointer-events: auto;
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* Only a keyboard visit shows the pill, which `:focus-visible` decides on its
   own — and a press shows it via `$dragging`, since a pointer capture keeps the
   gesture alive after the pointer has left the grip and `:active` has not. */
const StyledTiltPill = styled.span<{ $dragging: boolean }>`
  position: absolute;
  top: 3px;
  left: 38px;
  padding: 3px 9px;
  border-radius: 20px;
  background: #2a2118;
  color: #f6e5c9;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  transform: rotate(calc(var(--tilt, 0) * -1deg));
  transform-origin: left center;
  opacity: ${(p) => (p.$dragging ? 1 : 0)};

  ${StyledRotateGrip}:focus-visible ~ & {
    opacity: 1;
  }
`;
