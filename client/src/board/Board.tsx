import { useRef, useState } from "react";
import styled from "styled-components";
import { findStringBetween } from "@board/shared";
import type { Card as CardData, Connection } from "@board/shared";
import { Card } from "./Card";
import { GroupFrame, groupCards } from "./GroupFrame";
import { StringLayer } from "./StringLayer";
import type { FocusFrom } from "./useFocusFlight";
import { useViewport } from "./useViewport";

export interface BoardHandles {
  /** Board coordinates at the current viewport center (for placing cards). */
  viewportCenter: () => { x: number; y: number };
  /** Where a card sits on screen right now, for the focus view to fly out of.
   *  Null when it isn't on the board — the focus view then pops in instead. */
  takeoffFor: (cardId: string) => FocusFrom | null;
}

interface Props {
  cards: Record<string, CardData>;
  connections: Record<string, Connection>;
  editable: boolean;
  selectedId: string | null;
  focusedCardId: string | null;
  onFocusCard: (id: string, from: FocusFrom) => void;
  onSelectConnection: (id: string) => void;
  onClearSelection: () => void;
  onMoveCard: (id: string, x: number, y: number, commit: boolean) => void;
  onTiltCard: (id: string, rotation: number, commit: boolean) => void;
  onResizeFrame: (id: string, width: number, height: number, commit: boolean) => void;
  /** The group a dragged card is about to join, so its frame can light up. */
  dropTargetId: string | null;
  onCreateConnection: (fromCardId: string, toCardId: string) => void;
  handlesRef?: React.MutableRefObject<BoardHandles | null>;
}

export function Board({
  cards,
  connections,
  editable,
  selectedId,
  focusedCardId,
  onFocusCard,
  onSelectConnection,
  onClearSelection,
  onMoveCard,
  onTiltCard,
  onResizeFrame,
  dropTargetId,
  onCreateConnection,
  handlesRef,
}: Props) {
  const {
    vp,
    onWheel,
    onBackgroundPointerDown,
    onBackgroundPointerMove,
    onBackgroundPointerUp,
    screenToBoard,
  } = useViewport();

  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  if (handlesRef) {
    handlesRef.current = {
      viewportCenter: () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return screenToBoard(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          rect,
        );
      },
      takeoffFor: (cardId) => {
        const el = containerRef.current?.querySelector(
          `[data-card-id="${cardId}"]`,
        );
        if (!el) return null;
        // The centre of a rotated box's bounding box is still its centre, which
        // is why a tilted card can report an exact take-off point.
        const r = el.getBoundingClientRect();
        return {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          scale: vp.zoom,
        };
      },
    };
  }

  function handleTackClick(cardId: string) {
    if (!editable) return;
    if (pendingFrom === null) {
      setPendingFrom(cardId);
    } else if (pendingFrom !== cardId) {
      // Only one string per pair — tacking an already-strung card hands back
      // the string that is already there rather than laying a second one over it.
      const existing = findStringBetween(Object.values(connections), {
        fromCardId: pendingFrom,
        toCardId: cardId,
      });
      if (existing) onSelectConnection(existing.id);
      else onCreateConnection(pendingFrom, cardId);
      setPendingFrom(null);
      setCursor(null);
    } else {
      setPendingFrom(null);
      setCursor(null);
    }
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    onBackgroundPointerMove(e);
    if (pendingFrom !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCursor(screenToBoard(e.clientX, e.clientY, rect));
    }
  }

  function handleBackgroundDown(e: React.PointerEvent) {
    // Empty-space press: cancel pending string, clear selection, begin pan.
    if (pendingFrom !== null) {
      setPendingFrom(null);
      setCursor(null);
    }
    onClearSelection();
    onBackgroundPointerDown(e);
  }

  // Strings are drawn twice: their click targets below the cards (so a string
  // never covers the tack it hangs from) and their visible selves above.
  const stringProps = {
    connections: Object.values(connections),
    cards,
    editable,
    selectedId,
    pending:
      pendingFrom && cursor
        ? { fromCardId: pendingFrom, toX: cursor.x, toY: cursor.y }
        : null,
    onSelect: onSelectConnection,
  };

  return (
    <StyledBoardViewport
      ref={containerRef}
      onWheel={onWheel}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={onBackgroundPointerUp}
    >
      {/* Background layer captures pan + empty clicks. */}
      <StyledBoardBg onPointerDown={handleBackgroundDown} />

      <StyledBoardSurface
        // Rewritten on every pan and wheel frame, so it stays an inline style
        // rather than a prop — a class per pixel of travel would thrash.
        style={{
          transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`,
        }}
      >
        {/* Frames first: they belong behind every card and every string. */}
        {groupCards(Object.values(cards)).map((card) => (
          <GroupFrame
            key={`frame-${card.id}`}
            card={card}
            editable={editable}
            targeted={dropTargetId === card.id}
            zoom={vp.zoom}
            onResize={(w, h, commit) => onResizeFrame(card.id, w, h, commit)}
          />
        ))}

        <StringLayer {...stringProps} layer="hit" />

        {Object.values(cards).map((card) => (
          <Card
            key={card.id}
            card={card}
            editable={editable}
            focused={focusedCardId === card.id}
            connectArmed={pendingFrom !== null && pendingFrom !== card.id}
            zoom={vp.zoom}
            onFocus={onFocusCard}
            onDragMove={(id, x, y) => onMoveCard(id, x, y, false)}
            onDragEnd={(id, x, y) => onMoveCard(id, x, y, true)}
            onTilt={(rotation, commit) => onTiltCard(card.id, rotation, commit)}
            onTackClick={handleTackClick}
          />
        ))}

        <StringLayer {...stringProps} layer="art" />
      </StyledBoardSurface>

      {pendingFrom && (
        <StyledBoardHint>
          Click another card’s tack to tie the string · Esc / click empty to cancel
        </StyledBoardHint>
      )}
    </StyledBoardViewport>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

const StyledBoardViewport = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  background-color: var(--cork);
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.06) 0 2px, transparent 3px),
    radial-gradient(circle at 70% 60%, rgba(0, 0, 0, 0.08) 0 2px, transparent 3px),
    radial-gradient(circle at 40% 80%, rgba(0, 0, 0, 0.06) 0 1.5px, transparent 3px),
    radial-gradient(circle at 85% 20%, rgba(255, 255, 255, 0.05) 0 1.5px, transparent 3px),
    linear-gradient(0deg, var(--cork-dark), var(--cork));
  background-size: 40px 40px, 55px 55px, 34px 34px, 48px 48px, 100% 100%;
  box-shadow: inset 0 0 160px rgba(0, 0, 0, 0.45);
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

const StyledBoardBg = styled.div`
  position: absolute;
  inset: 0;
`;

const StyledBoardSurface = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
`;

const StyledBoardHint = styled.div`
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: #fbead0;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  pointer-events: none;
`;
