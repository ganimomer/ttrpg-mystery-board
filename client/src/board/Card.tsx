import { useMemo, useRef } from "react";
import type { Card as CardData } from "@board/shared";
import { CARD_HEIGHT, CARD_WIDTH } from "./layout";
import { RotateHandle } from "./RotateHandle";
import { tearPaths } from "./tear";
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
    if ((e.target as HTMLElement).closest(".tack-hit, .rotate-handle")) return;
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
  // one it is a sheet of paper torn from a notebook.
  const imageUrl = card.imageUrl;

  // Deterministic per card, so the rip never shifts under a re-render.
  const tear = useMemo(() => tearPaths(card.id), [card.id]);

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
      ref={root}
      className={[
        "card",
        imageUrl ? "" : "is-note",
        focused ? "is-focused" : "",
        connectArmed ? "is-connect-target" : "",
        card.revealed ? "" : "is-hidden",
        editable ? "is-editable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
        <div className="notepad-peek">
          <span className="notepad-peek-count">{card.notepad.length}</span>
        </div>
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
              {hasNotepad && (
                <div className="card-sheet-tidbits">
                  {card.notepad.map((t) => (
                    <span
                      key={t.id}
                      className={`card-sheet-tidbit ${t.revealed ? "" : "is-hidden"}`}
                    >
                      {t.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
