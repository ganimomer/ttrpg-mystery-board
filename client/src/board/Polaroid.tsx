import { useRef } from "react";
import type { Card } from "@board/shared";
import { api } from "../api";
import { CARD_HEIGHT, CARD_WIDTH } from "./layout";
import { Thumbtack } from "./Thumbtack";

interface Props {
  card: Card;
  editable: boolean;
  selected: boolean;
  connectArmed: boolean; // in connect mode, this card is a candidate target
  zoom: number;
  onSelect: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTackClick: (id: string) => void;
  onOpenNotepad: (id: string) => void;
}

export function Polaroid({
  card,
  editable,
  selected,
  connectArmed,
  zoom,
  onSelect,
  onDragMove,
  onDragEnd,
  onTackClick,
  onOpenNotepad,
}: Props) {
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!editable) return;
    if ((e.target as HTMLElement).closest(".tack-hit, .notepad-peek")) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
    onDragMove(card.id, Math.round(d.originX + dx), Math.round(d.originY + dy));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      onDragEnd(card.id, card.x, card.y);
    } else {
      onSelect(card.id);
    }
  }

  const hasNotepad = card.notepad.length > 0;

  return (
    <div
      className={[
        "polaroid",
        selected ? "is-selected" : "",
        connectArmed ? "is-connect-target" : "",
        card.revealed ? "" : "is-hidden",
        editable ? "is-editable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: card.x,
        top: card.y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: `rotate(${card.rotation}deg)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Lined yellow notepaper tucked behind the card, edge peeking below. */}
      {hasNotepad && (
        <button
          type="button"
          className="notepad-peek"
          title="Open notepad"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenNotepad(card.id);
          }}
        >
          <span className="notepad-peek-count">{card.notepad.length}</span>
        </button>
      )}

      <div className="polaroid-inner">
        <button
          type="button"
          className="tack-hit"
          title={editable ? "Start / finish a string here" : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTackClick(card.id);
          }}
        >
          <Thumbtack color={card.revealed ? "#d63031" : "#8d6e63"} />
        </button>

        <div className="polaroid-photo">
          {card.imageId ? (
            <img
              src={api.imageUrl(card.imageId)}
              alt={card.title}
              draggable={false}
            />
          ) : (
            <div className="polaroid-photo-empty">no photo</div>
          )}
        </div>
        <div className="polaroid-caption">
          {card.title && <div className="polaroid-title">{card.title}</div>}
          {card.note && <div className="polaroid-note">{card.note}</div>}
          {!card.title && !card.note && (
            <div className="polaroid-note polaroid-note--muted">…</div>
          )}
        </div>
      </div>
    </div>
  );
}
