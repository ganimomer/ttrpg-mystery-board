import { useRef } from "react";
import styled, { css } from "styled-components";
import type { Card as CardData } from "@board/shared";
import {
  CardFace,
  StyledCardInner,
  StyledCardSheet,
  StyledCardSheetFace,
} from "./CardFace";
import { CARD_HEIGHT, CARD_WIDTH } from "./layout";
import { RotateHandle, StyledRotateGrip, StyledRotateHandle } from "./RotateHandle";
import { Thumbtack } from "./Thumbtack";
import type { FocusFrom } from "./useFocusFlight";

interface Props {
  card: CardData;
  editable: boolean;
  focused: boolean; // this card is the one open in the focus view
  connectArmed: boolean; // in connect mode, this card is a candidate target
  zoom: number;
  onFocus: (id: string, from: FocusFrom) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTilt: (rotation: number, commit: boolean) => void;
  onTackClick: (id: string) => void;
}

export function Card({
  card,
  editable,
  focused,
  connectArmed,
  zoom,
  onFocus,
  onDragMove,
  onDragEnd,
  onTilt,
  onTackClick,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  // The press is recorded in both modes: a player can't move a card but can
  // still click one to bring it closer.
  function onPointerDown(e: React.PointerEvent) {
    // The tack and the rotate handle sit on the card but are not it: pressing
    // either must not start a drag.
    if ((e.target as HTMLElement).closest("[data-nodrag]")) return;
    if (editable) {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: card.x,
      originY: card.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
    if (editable) {
      onDragMove(card.id, Math.round(d.originX + dx), Math.round(d.originY + dy));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      if (editable) onDragEnd(card.id, card.x, card.y);
      return;
    }
    // Hand the focus view this card's place on screen to fly out of. A tilted
    // card rotates about its own middle, so the box's centre is exact.
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onFocus(card.id, {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      scale: zoom,
    });
  }

  const hasNotepad = card.notepad.length > 0;
  // The photo decides the prop: with one the card is a pinned polaroid, without
  // one it is a sheet of paper torn from a notebook. CardFace draws whichever it
  // is; everything here is about where the card sits and how it is handled.
  const imageUrl = card.imageUrl;

  const tack = (
    <StyledTackHit
      type="button"
      data-nodrag
      title={editable ? "Start / finish a string here" : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onTackClick(card.id);
      }}
    >
      <Thumbtack color={card.revealed ? "#d63031" : "#8d6e63"} />
    </StyledTackHit>
  );

  return (
    <StyledCard
      ref={root}
      data-card-id={card.id}
      $focused={focused}
      $connectTarget={connectArmed}
      $hidden={!card.revealed}
      $editable={editable}
      style={
        {
          left: card.x,
          top: card.y,
          width: CARD_WIDTH,
          // A sheet grows with what is written on it; a polaroid is a fixed print.
          height: imageUrl ? CARD_HEIGHT : undefined,
          transform: `rotate(${card.rotation}deg)`,
          // Read back by anything that has to stay upright on a tilted card.
          "--tilt": card.rotation,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {editable && (
        <RotateHandle rotation={card.rotation} targetRef={root} onTilt={onTilt} />
      )}

      {/* Lined yellow notepaper tucked behind the card, edge peeking below —
          a hint of what focusing the card will unfold. Sheets carry their
          tidbits on the page instead. */}
      {imageUrl && hasNotepad && (
        <StyledNotepadPeek>
          <StyledNotepadPeekCount>{card.notepad.length}</StyledNotepadPeekCount>
        </StyledNotepadPeek>
      )}

      <CardFace card={card} tack={tack} />
    </StyledCard>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* Yellow lined notepaper peeking out from under the card. */
const StyledNotepadPeek = styled.div`
  position: absolute;
  z-index: 0;
  left: 14px;
  right: 6px;
  bottom: -22px;
  height: 74px;
  border-radius: 2px 2px 3px 3px;
  transform: rotate(2.5deg);
  background-color: #fdf6b2;
  background-image:
    linear-gradient(90deg, transparent 16px, #f6c6c0 16px, #f6c6c0 17px, transparent 17px),
    repeating-linear-gradient(#fdf6b2 0 21px, #cdd9e6 21px 22px);
  box-shadow: 0 8px 14px rgba(0, 0, 0, 0.32);
  transition: bottom 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledNotepadPeekCount = styled.span`
  position: absolute;
  right: 6px;
  bottom: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #b0341d;
  color: #fff;
  font-family: var(--ui);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
`;

const StyledTackHit = styled.button`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  z-index: 3;
`;

/* A transparent positioned/rotated container; the paper inside it comes from
   CardFace. The z-index puts cards above the strings' click layer, below their
   art. */
const StyledCard = styled.div<{
  $focused: boolean;
  $connectTarget: boolean;
  $hidden: boolean;
  $editable: boolean;
}>`
  position: absolute;
  z-index: 1;
  user-select: none;
  cursor: pointer; /* every card can be brought closer */

  /* Slides out a little under the pointer — a hint that focusing the card will
     unfold the whole pad. */
  &:hover ${StyledNotepadPeek} {
    bottom: -28px;
  }

  ${(p) =>
    p.$editable &&
    css`
      cursor: grab;

      &:active {
        cursor: grabbing;
      }

      /* The handle lives outside the card's box but is one of its children, so
         hovering it keeps this rule true and the reveal holds. See the note in
         RotateHandle.tsx for why only the grip gates pointer-events. */
      &:hover ${StyledRotateHandle} {
        opacity: 1;
      }
      &:hover ${StyledRotateGrip} {
        pointer-events: auto;
      }
    `}

  ${(p) =>
    p.$connectTarget &&
    css`
      ${StyledCardInner} {
        box-shadow: 0 0 0 3px #2d9c5a, 0 14px 26px rgba(0, 0, 0, 0.5);
      }
      /* The ring is four hard offset shadows rather than a box-shadow ring,
         which would be a rectangle around a torn card. */
      ${StyledCardSheet} {
        filter: drop-shadow(2px 0 0 #2d9c5a) drop-shadow(-2px 0 0 #2d9c5a)
          drop-shadow(0 2px 0 #2d9c5a) drop-shadow(0 -2px 0 #2d9c5a)
          drop-shadow(0 12px 18px rgba(0, 0, 0, 0.5));
      }
    `}

  ${(p) =>
    p.$hidden &&
    css`
      opacity: 0.55;
      filter: grayscale(0.4);

      ${StyledCardInner}::after, ${StyledCardSheetFace}::after {
        content: "hidden";
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 10px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #fff;
        background: #8d6e63;
        padding: 2px 6px;
        border-radius: 4px;
      }
    `}

  /* The focus view is holding this one: its board self stands aside, so the two
     are never seen at once, while its strings keep hanging from the same spot. */
  ${(p) =>
    p.$focused &&
    css`
      opacity: 0;
    `}
`;
