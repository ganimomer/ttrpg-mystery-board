import { useEffect } from "react";
import type { Card } from "@board/shared";
import { api } from "../api";

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
                <>
                  <button
                    type="button"
                    className={`line-eye ${t.revealed ? "is-on" : ""}`}
                    title={t.revealed ? "Revealed to players" : "Hidden from players"}
                    onClick={() => save(t.id, { revealed: !t.revealed })}
                  >
                    {t.revealed ? "👁" : "🚫"}
                  </button>
                  <input
                    className="line-text"
                    defaultValue={t.text}
                    maxLength={2000}
                    placeholder="a tidbit…"
                    onBlur={(e) => {
                      if (e.target.value !== t.text) save(t.id, { text: e.target.value });
                    }}
                  />
                  <button
                    type="button"
                    className="line-del"
                    title="Delete line"
                    onClick={() =>
                      void api
                        .deleteTidbit(boardId, card.id, t.id)
                        .catch(() => {})
                    }
                  >
                    ×
                  </button>
                </>
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
