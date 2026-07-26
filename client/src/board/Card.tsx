import { useMemo, useRef } from "react";
import type { Card as CardData } from "@board/shared";
import { CARD_HEIGHT, CARD_WIDTH } from "./layout";
import { tearPaths } from "./tear";
import { Thumbtack } from "./Thumbtack";

interface Props {
  card: CardData;
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

export function Card({
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
    if (
      (e.target as HTMLElement).closest(
        ".tack-hit, .notepad-peek, .card-sheet-tidbits",
      )
    )
      return;
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
  // The photo decides the prop: with one the card is a pinned polaroid, without
  // one it is a sheet of paper torn from a notebook.
  const imageUrl = card.imageUrl;

  // Deterministic per card, so the rip never shifts under a re-render.
  const tear = useMemo(() => tearPaths(card.id), [card.id]);

  const openNotepad = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenNotepad(card.id);
  };

  const tack = (
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
  );

  return (
    <div
      className={[
        "card",
        imageUrl ? "" : "is-note",
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
        // A sheet grows with what is written on it; a polaroid is a fixed print.
        height: imageUrl ? CARD_HEIGHT : undefined,
        transform: `rotate(${card.rotation}deg)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Lined yellow notepaper tucked behind the card, edge peeking below.
          Sheets carry their tidbits on the page instead. */}
      {imageUrl && (hasNotepad || editable) && (
        <button
          type="button"
          className="notepad-peek"
          title="Open notepad"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={openNotepad}
        >
          <span className="notepad-peek-count">
            {hasNotepad ? card.notepad.length : "+"}
          </span>
        </button>
      )}

      {imageUrl ? (
        <div className="card-inner">
          {tack}
          <div className="card-photo">
            <img
              src={imageUrl}
              alt={card.title}
              draggable={false}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="card-caption">
            {card.title && <div className="card-title">{card.title}</div>}
            {card.note && <div className="card-note">{card.note}</div>}
            {!card.title && !card.note && (
              <div className="card-note card-note--muted">…</div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* The tack sits outside the sheet: it overhangs the top edge, where
              the face's clip-path would slice it, and it must stay clear of the
              wrapper's shadow and selection ring. */}
          {tack}
          <div
            className="card-sheet"
            style={
              {
                "--tear-face": tear.face,
                "--tear-fiber": tear.fiber,
              } as React.CSSProperties
            }
          >
            <div className="card-sheet-face">
              {card.title && <h3 className="card-sheet-title">{card.title}</h3>}
              {card.note && <p className="card-sheet-body">{card.note}</p>}
              {!card.title && !card.note && !hasNotepad && (
                <p className="card-sheet-body card-sheet-body--muted">…</p>
              )}
              {(hasNotepad || editable) && (
                <button
                  type="button"
                  className="card-sheet-tidbits"
                  aria-label="Open notepad"
                  title="Open notepad"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={openNotepad}
                >
                  {hasNotepad ? (
                    card.notepad.map((t) => (
                      <span
                        key={t.id}
                        className={`card-sheet-tidbit ${t.revealed ? "" : "is-hidden"}`}
                      >
                        {t.text}
                      </span>
                    ))
                  ) : (
                    <span className="card-sheet-tidbit card-sheet-tidbit--add">
                      + add a line
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
