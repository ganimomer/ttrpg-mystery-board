import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import type { Card } from "@board/shared";
import { api } from "../api";
import { StyledButton } from "../ui/Button";
import { StyledInput } from "../ui/Field";
import { sheetFace, StyledCardPhoto } from "./CardFace";
import { cardKind, TypeIcon, typeVars } from "./entityTypes";
import { EntityTypePill } from "./EntityTypePill";
import { FoldCorner, foldSize } from "./FoldCorner";
import { DeleteIcon, HideImageIcon } from "./icons";
import { MiniCard } from "./MiniCard";
import { RotateHandle, StyledRotateGrip, StyledRotateHandle } from "./RotateHandle";
import { StyledFocusPad, TidbitLines } from "./TidbitLines";
import { tearPaths } from "./tear";
import { useCommittedField } from "./useCommittedField";
import { useFocusFlight, type FocusFrom } from "./useFocusFlight";

interface Props {
  boardId: string;
  card: Card;
  editable: boolean;
  /** Where on the board this card was clicked; null when there is no board
   *  self to fly from, e.g. a card created a moment ago. */
  from: FocusFrom | null;
  /** The group this card sits in, if any — shown small above the card. */
  group: Card | null;
  /** The cards in this group, if this card is one — shown small underneath. */
  members: Card[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onTilt: (rotation: number, commit: boolean) => void;
  /** Move the focus to another card, without going back to the board. */
  onNavigate: (id: string) => void;
}

/**
 * One card, brought close: it flies off the board into the middle of the stage
 * with its note and notepad unfolded. A player reads it; a GM writes it, every
 * field edited in place — this is what replaced the side-panel inspector.
 */
export function CardFocus({
  boardId,
  card,
  editable,
  from,
  group,
  members,
  onClose,
  onDelete,
  onTilt,
  onNavigate,
}: Props) {
  const { shellRef, cardRef, open, requestClose } = useFocusFlight(from, onClose);

  const [foldOpen, setFoldOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [armed, setArmed] = useState(false); // delete asks before it fires
  const [page, setPage] = useState(0); // which five members are on show
  const titleRef = useRef<HTMLInputElement>(null);

  const save = (patch: Parameters<typeof api.updateCard>[2]) =>
    void api.updateCard(boardId, card.id, patch).catch(() => {});

  const title = useCommittedField(card.title, (value) => save({ title: value }));
  const note = useCommittedField(card.note, (value) => save({ note: value }));

  // Re-bound every render on purpose, so Escape always sees the live state: it
  // backs out of the URL field first, then an armed delete, then the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (urlOpen) setUrlOpen(false);
      else if (armed) setArmed(false);
      else requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // A card the GM just added has nothing on it yet — put the cursor in its name.
  useEffect(() => {
    if (editable && !from) titleRef.current?.focus();
  }, [editable, from]);

  const hasPhoto = card.imageUrl !== null && card.imageUrl !== "";
  // Only a GM has anything to show or hide, so only a GM's card is dog-eared.
  const fold = editable ? foldSize(card.revealed, foldOpen) : 0;
  const tear = useMemo(() => tearPaths(card.id, fold), [card.id, fold]);
  const printClip =
    fold > 0
      ? `polygon(0 0, calc(100% - ${fold}px) 0, 100% ${fold}px, 100% 100%, 0 100%)`
      : undefined;

  // What the card is, at the top-left of its frame. A GM picks it from the pill;
  // a group's kind is settled by the frame it carries, so it is shown rather than
  // offered — there is nothing to choose, and nothing that could disagree.
  const kind = cardKind(card);
  const mark =
    editable && !card.frame ? (
      <EntityTypePill
        value={card.entityType}
        onChange={(entityType) => save({ entityType })}
      />
    ) : kind ? (
      <TypeIcon
        kind={kind}
        size={22}
        title={card.frame ? "This card heads a group" : undefined}
      />
    ) : null;

  const fields = (
    <>
      {editable ? (
        <StyledFocusTitleInput
          {...title}
          ref={titleRef}
          maxLength={200}
          placeholder="Name this card"
        />
      ) : (
        card.title && <StyledFocusTitle>{card.title}</StyledFocusTitle>
      )}

      {editable ? (
        <NoteField field={note} />
      ) : card.note ? (
        <StyledFocusNote>{card.note}</StyledFocusNote>
      ) : (
        !card.title && <StyledFocusNote $muted>…</StyledFocusNote>
      )}
    </>
  );

  return (
    <StyledFocusBackdrop onPointerDown={requestClose}>
      {/* Pinned to the corner of the board, not to the card: the card's own
          top-right corner belongs to the fold. */}
      <StyledFocusClose type="button" aria-label="Close" onClick={requestClose}>
        ×
      </StyledFocusClose>

      <StyledFocusShell
        ref={shellRef}
        $print={hasPhoto}
        $open={open}
        // The card keeps the tilt it has on the board and the pad leans with
        // it, but each about its own centre — so the shell itself stays square
        // and the one control that must ignore the tilt can simply sit in it.
        style={{ "--tilt": card.rotation } as React.CSSProperties}
        onPointerDown={(e) => {
          e.stopPropagation();
          // Anywhere but the bin itself disarms it.
          if (!(e.target as HTMLElement).closest("[data-delete-zone]")) setArmed(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-label={card.title || "Card"}
      >
        {/* What this card belongs to, small, sitting over it on a dotted rule
            that echoes the group's frame out on the board. */}
        {group && (
          <StyledFocusPlate>
            <MiniCard card={group} onOpen={onNavigate} />
          </StyledFocusPlate>
        )}

        <StyledFocusCard
          ref={cardRef}
          style={{ ...typeVars(card), transform: `rotate(${card.rotation}deg)` }}
        >
          {editable && (
            <>
              <FoldCorner
                fold={fold}
                revealed={card.revealed}
                onOpenChange={setFoldOpen}
                onToggle={() => save({ revealed: !card.revealed })}
              />
              <RotateHandle
                rotation={card.rotation}
                targetRef={cardRef}
                onTilt={onTilt}
              />
            </>
          )}

          {hasPhoto ? (
            <StyledFocusFacePrint style={{ clipPath: printClip }}>
              <StyledFocusMark>{mark}</StyledFocusMark>
              <StyledFocusPhoto>
                <img
                  src={card.imageUrl!}
                  alt={card.title}
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {editable && (
                  <StyledFocusPhotoDel
                    type="button"
                    aria-label="Remove image"
                    title="Remove image"
                    onClick={() => save({ imageUrl: null })}
                  >
                    <HideImageIcon size={18} />
                  </StyledFocusPhotoDel>
                )}
              </StyledFocusPhoto>
              <StyledFocusCaption>{fields}</StyledFocusCaption>
            </StyledFocusFacePrint>
          ) : (
            <>
              {/* Pale fibre showing through the bites of the tear, as on the
                  board card — the face on top is clipped a little higher. */}
              <StyledFocusFiber style={{ clipPath: tear.fiber }} />
              <StyledFocusFaceSheet style={{ clipPath: tear.face }}>
                {/* In flow, as on the board sheet: with nothing to show, an
                    untyped sheet keeps its own margins. */}
                {mark && <StyledFocusSheetMark>{mark}</StyledFocusSheetMark>}
                {fields}
                {editable && !urlOpen && (
                  <StyledFocusAddPhoto type="button" onClick={() => setUrlOpen(true)}>
                    ＋ Add a photo
                  </StyledFocusAddPhoto>
                )}
              </StyledFocusFaceSheet>
            </>
          )}

          {editable && urlOpen && (
            <PhotoUrlField
              onSave={(url) => api.updateCard(boardId, card.id, { imageUrl: url })}
              onDone={() => setUrlOpen(false)}
            />
          )}
        </StyledFocusCard>

        {editable && (
          /* Sits astride the seam between the card and its pad, square to the
             screen whatever angle the card leans at. Asks before it fires: a
             bin with no label should not lose a card in one press. */
          <StyledFocusDelete $armed={armed} data-delete-zone>
            {armed && <StyledFocusDeleteAsk>Delete this card?</StyledFocusDeleteAsk>}
            <StyledFocusDeleteBtn
              type="button"
              aria-label={armed ? "Confirm delete card" : "Delete card"}
              title={armed ? "Press again to delete" : "Delete card"}
              onClick={() => (armed ? onDelete(card.id) : setArmed(true))}
            >
              <DeleteIcon size={20} />
            </StyledFocusDeleteBtn>
          </StyledFocusDelete>
        )}

        {(editable || card.notepad.length > 0) && (
          <TidbitLines boardId={boardId} card={card} editable={editable} />
        )}

        {card.frame && (
          <MemberRow
            members={members}
            editable={editable}
            page={page}
            onPage={setPage}
            onOpen={onNavigate}
          />
        )}
      </StyledFocusShell>
    </StyledFocusBackdrop>
  );
}

const PER_PAGE = 5;

/**
 * What is in this group, small, in the order the cards read inside its frame.
 * Five at a time — past that, an arrow each side turns the page.
 */
function MemberRow({
  members,
  editable,
  page,
  onPage,
  onOpen,
}: {
  members: Card[];
  editable: boolean;
  page: number;
  onPage: (page: number) => void;
  onOpen: (id: string) => void;
}) {
  if (members.length === 0) {
    return editable ? (
      <StyledFocusMembersEmpty>
        Drag cards inside the frame to gather them here.
      </StyledFocusMembersEmpty>
    ) : null;
  }

  const pages = Math.ceil(members.length / PER_PAGE);
  const current = Math.min(page, pages - 1);
  const first = current * PER_PAGE;
  const shown = members.slice(first, first + PER_PAGE);

  return (
    <StyledFocusMembers>
      <StyledFocusMembersRow>
        {pages > 1 && (
          <StyledMemberArrow
            type="button"
            aria-label="Previous cards"
            disabled={current === 0}
            onClick={() => onPage(current - 1)}
          >
            ‹
          </StyledMemberArrow>
        )}
        <StyledFocusMembersStrip>
          {shown.map((m) => (
            <MiniCard key={m.id} card={m} onOpen={onOpen} />
          ))}
        </StyledFocusMembersStrip>
        {pages > 1 && (
          <StyledMemberArrow
            type="button"
            aria-label="More cards"
            disabled={current >= pages - 1}
            onClick={() => onPage(current + 1)}
          >
            ›
          </StyledMemberArrow>
        )}
      </StyledFocusMembersRow>
      {pages > 1 && (
        <StyledFocusMembersCount>
          {first + 1}–{first + shown.length} of {members.length}
        </StyledFocusMembersCount>
      )}
    </StyledFocusMembers>
  );
}

/**
 * The note, at full length. It grows to fit what is written instead of
 * scrolling, and its own layout effect runs before the parent's flight is
 * measured (React flushes a child's layout effects first), so the card is
 * already its final height when the flight works out where to land.
 */
function NoteField({ field }: { field: ReturnType<typeof useCommittedField> }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [field.value]);

  return (
    <StyledFocusNoteInput
      {...field}
      ref={ref}
      maxLength={2000}
      rows={1}
      placeholder="What do they know?"
    />
  );
}

/**
 * A floating field for the one thing a photo needs: its address. Images are
 * hotlinked, never uploaded, and the server only stores http(s) links — it
 * answers a bad one with a flat "Invalid update", so the useful message is
 * written here.
 */
function PhotoUrlField({
  onSave,
  onDone,
}: {
  onSave: (url: string) => Promise<Card>;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  async function submit() {
    const url = value.trim();
    if (!url) return onDone();
    if (!/^https?:\/\/./i.test(url)) {
      setError("Paste a link starting with http:// or https://");
      return;
    }
    setBusy(true);
    try {
      await onSave(url);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that image");
      setBusy(false);
    }
  }

  return (
    <StyledFocusUrl>
      <StyledFocusUrlRow>
        <StyledFocusUrlInput
          ref={ref}
          value={value}
          placeholder="https://cdn.discordapp.com/…"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              onDone();
            }
          }}
        />
        <StyledButton type="button" disabled={busy} onClick={() => void submit()}>
          Add
        </StyledButton>
      </StyledFocusUrlRow>
      {error && <StyledFocusUrlError>{error}</StyledFocusUrlError>}
    </StyledFocusUrl>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */
/* The board keeps panning behind a blur while a single card floats over it.
   Layer order inside the focus card, from the back: the fold's well, the pale
   fibre, the paper face, the turned corner, its hit area, then the two controls
   that must never be cut away by the fold. Everything is stacked explicitly
   because the fold is written before the paper it is torn from. */

const StyledFocusBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  padding: 22px;
  overflow-y: auto;
  background: rgba(20, 14, 8, 0.55);
  backdrop-filter: blur(3px) saturate(0.85);
  animation: focus-dim 160ms ease both;

  @keyframes focus-dim {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const StyledFocusClose = styled.button`
  position: absolute;
  z-index: 8;
  top: 14px;
  right: 16px;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #2a2118;
  color: #f6e5c9;
  font-size: 21px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);

  &:hover {
    background: var(--accent);
  }
`;

const StyledFocusCard = styled.div`
  position: relative;
  /* Above the pad below it: the filter makes the card its own stacking context,
     so the floating URL field can only outrank the pad from out here. */
  z-index: 2;
  width: 100%;
  /* The shadow lives out here: clip-path is applied after filter, so a shadow
     on the clipped face would be cut away with the folded corner. */
  filter: drop-shadow(0 20px 32px rgba(0, 0, 0, 0.5));
`;

const focusFace = css`
  position: relative;
  z-index: 2;
  transition: clip-path 180ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* The frame is deepest at the top, where the type mark lives — the board card's
   own proportion, read close up. The band is there whether or not there is a
   mark in it, so a card does not change shape when a GM hands it to a player. */
const StyledFocusFacePrint = styled.div`
  ${focusFace}
  padding: 46px 18px 0;
  background-color: color-mix(in srgb, var(--type-ink) var(--type-mix), #fdfdf7);
  transition: background-color 200ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledFocusFaceSheet = styled.div`
  ${focusFace}
  ${sheetFace}
  padding: 26px 26px 40px;
`;

/* A 30px box either way, so the pill and the plain glyph it stands in for sit on
   the same line and the band never changes height under them. */
const markBox = css`
  display: flex;
  align-items: center;
  height: 30px;
`;

const StyledFocusMark = styled.div`
  ${markBox}
  position: absolute;
  z-index: 3;
  top: 8px;
  left: 18px;
`;

const StyledFocusSheetMark = styled.div`
  ${markBox}
  margin: 0 0 10px;
`;

/* Positioned so the hide-image button lands in the print's own corner rather
   than the face's, which is where the unpositioned photo box would send it. */
const StyledFocusPhoto = styled(StyledCardPhoto)`
  position: relative;
`;

const StyledFocusFiber = styled.div`
  position: absolute;
  z-index: 1;
  inset: 0 0 -5px 0;
  background: #fbf3e0;
`;

const StyledFocusCaption = styled.div`
  padding: 14px 6px 18px;
  text-align: center;
`;

/* Written on straight away rather than in a panel: no box, just a ruled line
   under the words that firms up as you reach for it. Layered *after* the
   typography below so its `color: inherit` still wins, as it did in the sheet. */
const focusInput = css`
  display: block;
  width: 100%;
  border: none;
  border-radius: 3px;
  padding: 2px 4px;
  background: transparent;
  color: inherit;
  text-align: inherit;
  resize: none;
  overflow: hidden;
  box-shadow: inset 0 -1px 0 rgba(90, 74, 46, 0.16);

  &::placeholder {
    color: rgba(90, 74, 46, 0.35);
  }
  &:hover {
    box-shadow: inset 0 -1px 0 rgba(90, 74, 46, 0.4);
  }
  &:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
`;

const focusTitle = css`
  margin: 0;
  font-family: var(--hand);
  font-size: 34px;
  font-weight: 700;
  line-height: 1.05;
  color: #23303e;
`;

const StyledFocusTitle = styled.h2`
  ${focusTitle}
`;

const StyledFocusTitleInput = styled.input`
  ${focusTitle}
  ${focusInput}
`;

const focusNote = css`
  margin: 8px 0 0;
  font-family: var(--hand);
  font-size: 22px;
  line-height: 1.25;
  color: #3a4653;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const StyledFocusNote = styled.p<{ $muted?: boolean }>`
  ${focusNote}
  ${(p) =>
    p.$muted &&
    css`
      color: #c1b79c;
    `}
`;

const StyledFocusNoteInput = styled.textarea`
  ${focusNote}
  ${focusInput}
`;

const StyledFocusAddPhoto = styled.button`
  margin: 18px 0 0;
  padding: 6px 13px;
  border: 1px dashed rgba(90, 74, 46, 0.45);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.35);
  color: #6b5c44;
  font-family: var(--ui);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: #fff;
  }
`;

/* Inside the print, at the far corner from the fold — the two controls on this
   card never crowd each other. */
const StyledFocusPhotoDel = styled.button`
  position: absolute;
  z-index: 5;
  right: 8px;
  bottom: 8px;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(20, 14, 8, 0.6);
  color: #fff;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: var(--accent);
  }
`;

const StyledFocusUrl = styled.div`
  position: absolute;
  z-index: 6;
  left: 10px;
  right: 10px;
  top: calc(100% + 10px);
  padding: 10px;
  border-radius: 10px;
  background: var(--panel);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.5);
`;

const StyledFocusUrlRow = styled.div`
  display: flex;
  gap: 8px;
`;

const StyledFocusUrlInput = styled(StyledInput)`
  flex: 1;
  min-width: 0;

  &:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`;

const StyledFocusUrlError = styled.p`
  margin: 8px 2px 0;
  font-size: 12px;
  color: #a3301b;
`;

/* The group a focused card belongs to, standing over it on a dotted rule that
   echoes the frame the group draws on the board. */
const StyledFocusPlate = styled.div`
  display: flex;
  justify-content: center;
  padding-bottom: 10px;
  border-bottom: 2px dotted rgba(246, 229, 201, 0.4);
`;

/* What is inside a focused group. */
const StyledFocusMembers = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const StyledFocusMembersRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

/* Always as wide as five minis, so the row holds still as the pages turn — it
   ends up wider than the card above it, which reads as a tray under a shelf.
   Only a narrow window makes it scroll. */
const StyledFocusMembersStrip = styled.div`
  display: flex;
  gap: 8px;
  width: calc(5 * 104px + 4 * 8px);
  max-width: calc(100vw - 120px);
  overflow-x: auto;
  justify-content: center;
`;

const StyledMemberArrow = styled.button`
  flex: none;
  width: 30px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: rgba(20, 14, 8, 0.55);
  color: #f6e5c9;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--accent);
  }
  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const membersNote = css`
  margin: 0;
  color: #e8dbbe;
  font-size: 12px;
  letter-spacing: 0.03em;
`;

const StyledFocusMembersCount = styled.p`
  ${membersNote}
`;

const StyledFocusMembersEmpty = styled.p`
  ${membersNote}
  text-align: center;
  font-family: var(--hand);
  font-size: 17px;
  opacity: 0.75;
`;

/* One button for one destructive action, sitting astride the seam between the
   card and its pad. A zero-height flex row: it adds a second gap to the gutter,
   so the button straddles the join without covering either surface's text, and
   nothing about the layout depends on how tall the card happens to be. */
const StyledFocusDeleteBtn = styled.button`
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #2a2118;
  color: #f6e5c9;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.5);
  transition: background 150ms ease;

  &:hover {
    background: var(--accent);
  }
`;

const StyledFocusDelete = styled.div<{ $armed: boolean }>`
  position: relative;
  z-index: 3;
  height: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  ${(p) =>
    p.$armed &&
    css`
      ${StyledFocusDeleteBtn} {
        background: var(--accent);
      }
    `}
`;

const StyledFocusDeleteAsk = styled.span`
  position: absolute;
  left: calc(50% + 30px);
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
`;

/* `margin: auto` rather than centred flex alignment: a card taller than the
   stage then scrolls instead of having its top cut off. */
const StyledFocusShell = styled.div<{ $print: boolean; $open: boolean }>`
  position: relative;
  margin: auto;
  width: min(460px, 86vw);
  display: flex;
  flex-direction: column;
  gap: 14px;
  /* The shell stays square: the card and the pad each lean by --tilt about
     their own centre, which keeps their facing edges parallel and leaves the
     bin free to sit at the card's bottom centre whatever the angle. The flight
     in and out is animated from useFocusFlight, not from here. */
  will-change: transform;

  /* A print is square plus its caption, so it is the height that runs out
     first; the print's width is what has to give to keep the card in view. */
  ${(p) =>
    p.$print &&
    css`
      width: min(460px, 86vw, 46vh);
    `}

  /* The pad and the bin belong to the reading of the card, not to the paper —
     they arrive once it has landed. Opacity only: anything that moved the
     layout mid-flight would invalidate the geometry it was measured from. */
  ${StyledFocusPad},
  ${StyledFocusDelete},
  ${StyledFocusPlate},
  ${StyledFocusMembers},
  ${StyledFocusMembersEmpty} {
    transition: opacity 180ms ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  ${(p) =>
    !p.$open &&
    css`
      ${StyledFocusPad},
      ${StyledFocusDelete},
      ${StyledFocusPlate},
      ${StyledFocusMembers},
      ${StyledFocusMembersEmpty} {
        opacity: 0;
      }
    `}

  /* The one card being worked on keeps its rotate handle out, arriving with the
     pad and the bin once the paper has landed. */
  ${(p) =>
    p.$open &&
    css`
      ${StyledRotateHandle} {
        opacity: 1;
      }
      ${StyledRotateGrip} {
        pointer-events: auto;
      }
    `}
`;
