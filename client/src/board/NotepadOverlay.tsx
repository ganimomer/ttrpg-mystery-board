import { useEffect } from "react";
import type { Card, Tidbit } from "@board/shared";
import { api } from "../api";
import { useCommittedField } from "./useCommittedField";

interface Props {
  boardId: string;
  card: Card;
  editable: boolean;
  onClose: () => void;
}

export function NotepadOverlay({ boardId, card, editable, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = card.notepad;
  const firstHidden = items.find((t) => !t.revealed);

  const save = (tidbitId: string, patch: { text?: string; revealed?: boolean }) =>
    void api.updateTidbit(boardId, card.id, tidbitId, patch).catch(() => {});

  return (
    <div className="notepad-backdrop" onPointerDown={onClose}>
      <div
        className="notepad-sheet"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Notepad for ${card.title || "card"}`}
      >
        <div className="notepad-head">
          <h3>{card.title || "Notes"}</h3>
          <button className="notepad-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <ul className="notepad-lines">
          {items.length === 0 && (
            <li className="notepad-empty">
              {editable ? "Add a line to start the notepad." : "Nothing here yet."}
            </li>
          )}
          {items.map((t) => (
            <li
              key={t.id}
              className={`notepad-line ${t.revealed ? "is-revealed" : "is-hidden"}`}
            >
              {editable ? (
                <TidbitLine
                  tidbit={t}
                  onSave={(patch) => save(t.id, patch)}
                  onDelete={() =>
                    void api.deleteTidbit(boardId, card.id, t.id).catch(() => {})
                  }
                />
              ) : (
                <span className="line-text-static">{t.text}</span>
              )}
            </li>
          ))}
        </ul>

        {editable && (
          <div className="notepad-actions">
            <button
              className="btn"
              onClick={() =>
                void api.addTidbit(boardId, card.id, {}).catch(() => {})
              }
            >
              + Add a line
            </button>
            <button
              className="btn btn--ghost"
              disabled={!firstHidden}
              title="Reveal the next hidden tidbit"
              onClick={() =>
                firstHidden && save(firstHidden.id, { revealed: true })
              }
            >
              Reveal next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One editable notepad line. Its own component so the text can commit on
 *  unmount — closing the overlay (backdrop, ×, Escape) saves the edit. */
function TidbitLine({
  tidbit,
  onSave,
  onDelete,
}: {
  tidbit: Tidbit;
  onSave: (patch: { text?: string; revealed?: boolean }) => void;
  onDelete: () => void;
}) {
  const text = useCommittedField(tidbit.text, (value) => onSave({ text: value }));

  return (
    <>
      <button
        type="button"
        className={`line-eye ${tidbit.revealed ? "is-on" : ""}`}
        title={tidbit.revealed ? "Revealed to players" : "Hidden from players"}
        onClick={() => onSave({ revealed: !tidbit.revealed })}
      >
        {tidbit.revealed ? "👁" : "🚫"}
      </button>
      <input {...text} className="line-text" maxLength={2000} placeholder="a tidbit…" />
      <button type="button" className="line-del" title="Delete line" onClick={onDelete}>
        ×
      </button>
    </>
  );
}
