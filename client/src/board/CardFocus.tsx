import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Card } from "@board/shared";
import { api } from "../api";
import { FoldCorner, foldSize } from "./FoldCorner";
import { DeleteIcon, HideImageIcon } from "./icons";
import { RotateHandle } from "./RotateHandle";
import { TidbitLines } from "./TidbitLines";
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
  onClose: () => void;
  onDelete: (id: string) => void;
  onTilt: (rotation: number, commit: boolean) => void;
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
  onClose,
  onDelete,
  onTilt,
}: Props) {
  const { shellRef, cardRef, open, requestClose } = useFocusFlight(from, onClose);

  const [foldOpen, setFoldOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [armed, setArmed] = useState(false); // delete asks before it fires
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

  const fields = (
    <>
      {editable ? (
        <input
          {...title}
          ref={titleRef}
          className="focus-title focus-input"
          maxLength={200}
          placeholder="Name this card"
        />
      ) : (
        card.title && <h2 className="focus-title">{card.title}</h2>
      )}

      {editable ? (
        <NoteField field={note} />
      ) : card.note ? (
        <p className="focus-note">{card.note}</p>
      ) : (
        !card.title && <p className="focus-note focus-note--muted">…</p>
      )}
    </>
  );

  return (
    <div className="focus-backdrop" onPointerDown={requestClose}>
      {/* Pinned to the corner of the board, not to the card: the card's own
          top-right corner belongs to the fold. */}
      <button
        type="button"
        className="focus-close"
        aria-label="Close"
        onClick={requestClose}
      >
        ×
      </button>

      <div
        ref={shellRef}
        className={[
          "focus-shell",
          hasPhoto ? "focus-shell--print" : "",
          open ? "is-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        // The card keeps the tilt it has on the board and the pad leans with
        // it, but each about its own centre — so the shell itself stays square
        // and the one control that must ignore the tilt can simply sit in it.
        style={{ "--tilt": card.rotation } as React.CSSProperties}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!(e.target as HTMLElement).closest(".focus-delete")) setArmed(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-label={card.title || "Card"}
      >
        <div
          ref={cardRef}
          className={`focus-card ${hasPhoto ? "focus-card--print" : "focus-card--sheet"}`}
          style={{ transform: `rotate(${card.rotation}deg)` }}
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
            <div className="focus-face focus-face--print" style={{ clipPath: printClip }}>
              <div className="card-photo focus-photo">
                <img
                  src={card.imageUrl!}
                  alt={card.title}
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {editable && (
                  <button
                    type="button"
                    className="focus-photo-del"
                    aria-label="Remove image"
                    title="Remove image"
                    onClick={() => save({ imageUrl: null })}
                  >
                    <HideImageIcon size={18} />
                  </button>
                )}
              </div>
              <div className="focus-caption">{fields}</div>
            </div>
          ) : (
            <>
              {/* Pale fibre showing through the bites of the tear, as on the
                  board card — the face on top is clipped a little higher. */}
              <div className="focus-fiber" style={{ clipPath: tear.fiber }} />
              <div className="focus-face focus-face--sheet" style={{ clipPath: tear.face }}>
                {fields}
                {editable && !urlOpen && (
                  <button
                    type="button"
                    className="focus-add-photo"
                    onClick={() => setUrlOpen(true)}
                  >
                    ＋ Add a photo
                  </button>
                )}
              </div>
            </>
          )}

          {editable && urlOpen && (
            <PhotoUrlField
              onSave={(url) => api.updateCard(boardId, card.id, { imageUrl: url })}
              onDone={() => setUrlOpen(false)}
            />
          )}
        </div>

        {editable && (
          /* Sits astride the seam between the card and its pad, square to the
             screen whatever angle the card leans at. Asks before it fires: a
             bin with no label should not lose a card in one press. */
          <div className={`focus-delete ${armed ? "is-armed" : ""}`}>
            {armed && <span className="focus-delete-ask">Delete this card?</span>}
            <button
              type="button"
              className="focus-delete-btn"
              aria-label={armed ? "Confirm delete card" : "Delete card"}
              title={armed ? "Press again to delete" : "Delete card"}
              onClick={() => (armed ? onDelete(card.id) : setArmed(true))}
            >
              <DeleteIcon size={20} />
            </button>
          </div>
        )}

        {(editable || card.notepad.length > 0) && (
          <TidbitLines boardId={boardId} card={card} editable={editable} />
        )}
      </div>
    </div>
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
    <textarea
      {...field}
      ref={ref}
      className="focus-note focus-input"
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
    <div className="focus-url">
      <div className="focus-url-row">
        <input
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
        <button type="button" className="btn" disabled={busy} onClick={() => void submit()}>
          Add
        </button>
      </div>
      {error && <p className="focus-url-error">{error}</p>}
    </div>
  );
}
