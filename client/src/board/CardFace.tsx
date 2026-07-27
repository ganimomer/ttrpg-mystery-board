import { useMemo } from "react";
import type { Card as CardData } from "@board/shared";
import { tearPaths } from "./tear";

interface Props {
  card: CardData;
  /** The thumbtack, when this face is pinned to the board. Minis get none. */
  tack?: React.ReactNode;
}

/**
 * The paper a card is printed on, and nothing else — no position, no drag, no
 * handles. [Card.tsx] wraps it for the board; [MiniCard.tsx] scales it down for
 * the rows in the focus view, which is the whole reason it lives apart: a small
 * version of a card should *be* the card, not a second drawing of one.
 */
export function CardFace({ card, tack }: Props) {
  const hasNotepad = card.notepad.length > 0;
  // The photo decides the prop: with one the card is a pinned polaroid, without
  // one it is a sheet of paper torn from a notebook.
  const imageUrl = card.imageUrl;

  // Deterministic per card, so the rip never shifts under a re-render — and a
  // mini tears exactly like its full-size self.
  const tear = useMemo(() => tearPaths(card.id), [card.id]);

  if (imageUrl) {
    return (
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
    );
  }

  return (
    <>
      {/* The tack sits outside the sheet: it overhangs the top edge, where the
          face's clip-path would slice it, and it must stay clear of the
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
  );
}
