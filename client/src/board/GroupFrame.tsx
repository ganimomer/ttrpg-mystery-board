import { useRef, useState } from "react";
import styled, { css } from "styled-components";
import type { Card } from "@board/shared";
import { FRAME_MIN, frameRect } from "./layout";

interface Props {
  card: CardWithFrame;
  editable: boolean;
  /** A card is being dragged into this frame right now. */
  targeted: boolean;
  zoom: number;
  onResize: (width: number, height: number, commit: boolean) => void;
}

/** A group card, narrowed: `frame` is what makes it one. */
type CardWithFrame = Card & { frame: NonNullable<Card["frame"]> };

/**
 * The dotted rectangle drawn around a group's cards, hanging below its
 * nameplate. Rendered behind every card and it never swallows a pointer — the
 * cork underneath must stay draggable — except at the resize grip in its corner.
 */
export function GroupFrame({ card, editable, targeted, zoom, onResize }: Props) {
  const rect = frameRect(card)!;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const [resizing, setResizing] = useState(false);

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      width: card.frame.width,
      height: card.frame.height,
    };
    setResizing(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // The frame grows about the nameplate, so it widens at twice the pointer's
    // horizontal travel — one edge each side.
    const dx = ((e.clientX - d.startX) / zoom) * 2;
    const dy = (e.clientY - d.startY) / zoom;
    onResize(
      Math.max(FRAME_MIN.width, Math.round(d.width + dx)),
      Math.max(FRAME_MIN.height, Math.round(d.height + dy)),
      false,
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setResizing(false);
    onResize(card.frame.width, card.frame.height, true);
  }

  return (
    <StyledGroupFrame
      $targeted={targeted}
      $resizing={resizing}
      $hidden={!card.revealed}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      {editable && (
        <StyledFrameResize
          type="button"
          aria-label={`Resize ${card.title || "group"}`}
          title="Drag to resize the group"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </StyledGroupFrame>
  );
}

/** Narrows a card list to the groups in it. */
export function groupCards(cards: Card[]): CardWithFrame[] {
  return cards.filter((c): c is CardWithFrame => c.frame !== null);
}

/* ─── styles ───────────────────────────────────────────────────── */

/* A group is a card wearing a nameplate at the top of this dotted rectangle;
   the cards sitting inside it belong to it. It is drawn behind everything and
   lets the pointer through — the cork inside a group has to stay draggable, and
   the cards on top of it must catch their own clicks. */
const StyledGroupFrame = styled.div<{
  $targeted: boolean;
  $resizing: boolean;
  $hidden: boolean;
}>`
  position: absolute;
  z-index: 0;
  pointer-events: none;
  border: 3px dotted rgba(48, 34, 16, 0.62);
  border-radius: 10px;
  background: rgba(255, 246, 226, 0.07);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.12);
  transition: border-color 0.15s ease, background 0.15s ease;

  /* The card being dragged is about to join this group. */
  ${(p) =>
    p.$targeted &&
    css`
      border-color: #2d9c5a;
      background: rgba(45, 156, 90, 0.09);
    `}

  /* A pointer capture can carry the drag outside the grip, so :active would
     drop out mid-resize — this one has to stay a React state. */
  ${(p) =>
    p.$resizing &&
    css`
      border-style: dashed;
      border-color: var(--accent);
    `}

  /* GM-only: a group the players cannot see yet, dimmed like its own card. */
  ${(p) =>
    p.$hidden &&
    css`
      opacity: 0.5;
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** The two diagonal strokes of the grip, painted in whatever colour it wants. */
const gripStripes = (color: string) => css`
  background:
    linear-gradient(
      135deg,
      transparent 45%,
      ${color} 45%,
      ${color} 60%,
      transparent 60%,
      transparent 72%,
      ${color} 72%,
      ${color} 87%,
      transparent 87%
    );
`;

/* Sits inside the frame's corner, so unlike the rotate handle it needs no
   bridge to be reachable. */
const StyledFrameResize = styled.button`
  position: absolute;
  right: -9px;
  bottom: -9px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  pointer-events: auto;
  cursor: nwse-resize;
  touch-action: none;
  ${gripStripes("rgba(58, 43, 22, 0.75)")}

  &:hover,
  &:focus-visible {
    outline: none;
    ${gripStripes("var(--accent)")}
  }
`;
