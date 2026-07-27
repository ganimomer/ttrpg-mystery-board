import { useRef, useState } from "react";
import type { Card as CardData, Connection } from "@board/shared";
import { Card } from "./Card";
import { StringLayer } from "./StringLayer";
import type { FocusFrom } from "./useFocusFlight";
import { useViewport } from "./useViewport";

export interface BoardHandles {
  /** Board coordinates at the current viewport center (for placing cards). */
  viewportCenter: () => { x: number; y: number };
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
    };
  }

  function handleTackClick(cardId: string) {
    if (!editable) return;
    if (pendingFrom === null) {
      setPendingFrom(cardId);
    } else if (pendingFrom !== cardId) {
      onCreateConnection(pendingFrom, cardId);
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
    <div
      ref={containerRef}
      className="board-viewport"
      onWheel={onWheel}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={onBackgroundPointerUp}
    >
      {/* Background layer captures pan + empty clicks. */}
      <div className="board-bg" onPointerDown={handleBackgroundDown} />

      <div
        className="board-surface"
        style={{
          transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`,
        }}
      >
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
      </div>

      {pendingFrom && (
        <div className="board-hint">Click another card’s tack to tie the string · Esc / click empty to cancel</div>
      )}
    </div>
  );
}
