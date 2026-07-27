import type { Card, Tidbit } from "@board/shared";
import { api } from "../api";
import { VisibilityIcon, VisibilityOffIcon } from "./icons";
import { useCommittedField } from "./useCommittedField";

interface Props {
  boardId: string;
  card: Card;
  editable: boolean;
}

/** The card's notepad, unfolded: one line per tidbit on yellow lined paper. */
export function TidbitLines({ boardId, card, editable }: Props) {
  const items = card.notepad;
  const firstHidden = items.find((t) => !t.revealed);

  const save = (tidbitId: string, patch: { text?: string; revealed?: boolean }) =>
    void api.updateTidbit(boardId, card.id, tidbitId, patch).catch(() => {});

  return (
    <div className="focus-pad">
      <ul className="notepad-lines">
        {items.length === 0 && (
          <li className="notepad-empty">Add a line to start the notepad.</li>
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
            onClick={() => void api.addTidbit(boardId, card.id, {}).catch(() => {})}
          >
            + Add a line
          </button>
          <button
            className="btn btn--ghost"
            disabled={!firstHidden}
            title="Reveal the next hidden tidbit"
            onClick={() => firstHidden && save(firstHidden.id, { revealed: true })}
          >
            Reveal next
          </button>
        </div>
      )}
    </div>
  );
}

/** One editable notepad line. Its own component so the text can commit on
 *  unmount — leaving the focused card saves the edit. */
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
        aria-label={tidbit.revealed ? "Hide this line" : "Show this line"}
        onClick={() => onSave({ revealed: !tidbit.revealed })}
      >
        {tidbit.revealed ? <VisibilityIcon size={17} /> : <VisibilityOffIcon size={17} />}
      </button>
      <input {...text} className="line-text" maxLength={2000} placeholder="a tidbit…" />
      <button type="button" className="line-del" title="Delete line" onClick={onDelete}>
        ×
      </button>
    </>
  );
}
