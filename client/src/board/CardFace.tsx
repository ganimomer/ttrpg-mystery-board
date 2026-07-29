import { useMemo } from "react";
import styled, { css } from "styled-components";
import type { Card as CardData } from "@board/shared";
import { cardKind, TypeIcon, typeVars } from "./entityTypes";
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

  // What the card is, said twice over: a glyph in the frame, and the same colour
  // washed faintly through the paper it is printed on.
  const kind = cardKind(card);

  if (imageUrl) {
    return (
      <StyledCardInner style={typeVars(card)}>
        {tack}
        {kind && (
          <StyledCardMark>
            <TypeIcon kind={kind} size={18} />
          </StyledCardMark>
        )}
        <StyledCardPhoto>
          <img
            src={imageUrl}
            alt={card.title}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </StyledCardPhoto>
        <StyledCardCaption>
          {card.title && <StyledCardTitle>{card.title}</StyledCardTitle>}
          {card.note && <StyledCardNote>{card.note}</StyledCardNote>}
          {!card.title && !card.note && <StyledCardNote $muted>…</StyledCardNote>}
        </StyledCardCaption>
      </StyledCardInner>
    );
  }

  return (
    <>
      {/* The tack sits outside the sheet: it overhangs the top edge, where the
          face's clip-path would slice it, and it must stay clear of the
          wrapper's shadow and selection ring. */}
      {tack}
      <StyledCardSheet
        style={
          {
            ...typeVars(card),
            "--tear-face": tear.face,
            "--tear-fiber": tear.fiber,
          } as React.CSSProperties
        }
      >
        <StyledCardSheetFace>
          {/* In flow rather than pinned to the corner: an untyped sheet then has
              no gap where a glyph would have been, and reads exactly as before. */}
          {kind && (
            <StyledSheetMark>
              <TypeIcon kind={kind} size={18} />
            </StyledSheetMark>
          )}
          {card.title && <StyledCardSheetTitle>{card.title}</StyledCardSheetTitle>}
          {card.note && <StyledCardSheetBody>{card.note}</StyledCardSheetBody>}
          {!card.title && !card.note && !hasNotepad && (
            <StyledCardSheetBody $muted>…</StyledCardSheetBody>
          )}
          {hasNotepad && (
            <StyledCardSheetTidbits>
              {card.notepad.map((t) => (
                <StyledCardSheetTidbit key={t.id} $hidden={!t.revealed}>
                  {t.text}
                </StyledCardSheetTidbit>
              ))}
            </StyledCardSheetTidbits>
          )}
        </StyledCardSheetFace>
      </StyledCardSheet>
    </>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* The white card, painted above the notepad peek that hides behind it. The top
   of the frame is wider than the sides — a polaroid's is anyway, and this one has
   to hold the type glyph without crowding the print. The stock is the kind's ink
   mixed faintly into the paper; untyped mixes 0% and stays exactly #fdfdf7. */
export const StyledCardInner = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  background-color: color-mix(in srgb, var(--type-ink) var(--type-mix), #fdfdf7);
  padding: 30px 14px 0;
  border-radius: 2px;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
  transition: box-shadow 0.15s ease, background-color 200ms ease;
  display: flex;
  flex-direction: column;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* In the frame above the print, opposite the corner the "hidden" badge takes. */
const StyledCardMark = styled.div`
  position: absolute;
  top: 6px;
  left: 13px;
`;

export const StyledCardPhoto = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #e9e4d6;
  overflow: hidden;
  display: grid;
  place-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const StyledCardCaption = styled.div`
  padding: 8px 4px 12px;
  text-align: center;
  min-height: 46px;
`;

const StyledCardTitle = styled.div`
  font-family: var(--hand);
  font-size: 22px;
  font-weight: 700;
  color: #23303e;
  line-height: 1.05;
`;

const StyledCardNote = styled.div<{ $muted?: boolean }>`
  font-family: var(--hand);
  font-size: 17px;
  color: ${(p) => (p.$muted ? "#c1b79c" : "#3a4653")};
  line-height: 1.1;
  white-space: pre-wrap;
`;

/* ─── Note sheet (a card with no photo) ────────────────────────── */

/* Warm foolscap rather than the polaroid's cool print stock, ripped along the
   bottom. The sheet stays unclipped so its ::before can carry a paler fiber
   layer that shows through the bites; the face on top is clipped by the seeded
   polygon from tear.ts. Both polygons arrive as inline custom props.
   The shadow belongs to the wrapper, not the clipped layers: `clip-path` is
   applied *after* `filter`, so a shadow on a clipped element is cut away with
   the rest of the box. From out here it traces the whole torn silhouette. */
export const StyledCardSheet = styled.div`
  position: relative;
  min-height: 110px;
  filter: drop-shadow(0 9px 14px rgba(0, 0, 0, 0.42));
  transition: filter 0.15s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 -5px 0;
    z-index: 0;
    background: #fbf3e0;
    clip-path: var(--tear-fiber);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Also worn by the focused card's sheet — same stock, read at arm's length.
 *  Tinted like the polaroid, but at three-quarters the strength: foolscap is
 *  already a colour, so the same mix would read twice as loud on it as it does
 *  on white print stock. */
export const sheetFace = css`
  position: relative;
  z-index: 1;
  padding: 16px 16px 26px;
  color: #33302a;
  background-color: color-mix(
    in srgb,
    var(--type-ink) calc(var(--type-mix) * 0.75),
    #f2e9d3
  );
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.5),
    rgba(255, 255, 255, 0) 42%,
    rgba(150, 120, 70, 0.09)
  );
  clip-path: var(--tear-face);
  transition: background-color 200ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* Above the title on a sheet, where the polaroid wears its own. */
const StyledSheetMark = styled.div`
  margin: 0 0 6px;
`;

export const StyledCardSheetFace = styled.div`
  ${sheetFace}
`;

const StyledCardSheetTitle = styled.h3`
  display: inline-block;
  position: relative;
  margin: 0 0 8px;
  padding-bottom: 6px;
  font-family: var(--hand);
  font-size: 25px;
  font-weight: 700;
  line-height: 1.05;
  color: #2f3b47;

  /* Ruled by hand, not by text-decoration: it overshoots and sits slightly off. */
  &::after {
    content: "";
    position: absolute;
    left: -2px;
    right: -5px;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: rgba(47, 59, 71, 0.55);
    transform: rotate(-0.7deg);
  }
`;

const StyledCardSheetBody = styled.p<{ $muted?: boolean }>`
  margin: 0;
  font-family: var(--hand);
  font-size: 17px;
  line-height: 1.2;
  color: ${(p) => (p.$muted ? "#b3a889" : "#3a4653")};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  /* A 2000-character note must not grow into a board-sized sheet; the full
     text stays readable and editable in the inspector. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 9;
  overflow: hidden;
`;

const StyledCardSheetTidbits = styled.div`
  margin: 10px 0 0;
  padding: 8px 0 0;
  border-top: 1px solid rgba(90, 74, 46, 0.28);
`;

const StyledCardSheetTidbit = styled.span<{ $hidden: boolean }>`
  display: block;
  position: relative;
  padding-left: 14px;
  font-family: var(--hand);
  font-size: 16px;
  line-height: 1.15;
  color: #4a4436;
  overflow-wrap: anywhere;
  /* GM-only: a tidbit the players have not been shown yet. */
  opacity: ${(p) => (p.$hidden ? 0.5 : 1)};

  & + & {
    margin-top: 3px;
  }

  &::before {
    content: "–";
    position: absolute;
    left: 0;
    color: rgba(90, 74, 46, 0.6);
  }
`;
