import type { Card, Connection } from "@board/shared";
import { api } from "../api";
import { useCommittedField } from "./useCommittedField";

const STRING_COLORS = ["#c0392b", "#2c3e50", "#27ae60", "#8e44ad", "#d35400", "#16a085"];

interface CardInspectorProps {
  boardId: string;
  card: Card;
  onDelete: (id: string) => void;
  onOpenNotepad: (id: string) => void;
}

export function CardInspector({ boardId, card, onDelete, onOpenNotepad }: CardInspectorProps) {
  const save = (patch: Parameters<typeof api.updateCard>[2]) =>
    void api.updateCard(boardId, card.id, patch).catch(() => {});

  // BoardView keys this panel by card id, so switching cards unmounts it and
  // each field commits whatever was typed. See useCommittedField.
  const title = useCommittedField(card.title, (value) => save({ title: value }));
  const note = useCommittedField(card.note, (value) => save({ note: value }));
  const imageUrl = useCommittedField(card.imageUrl ?? "", (value) =>
    save({ imageUrl: value.trim() || null }),
  );

  return (
    <div className="inspector">
      <div className="inspector-head">
        <h3>Card</h3>
        <RevealToggle
          revealed={card.revealed}
          onChange={(revealed) => save({ revealed })}
        />
      </div>

      <label className="field">
        <span>Title</span>
        <input {...title} maxLength={200} placeholder="e.g. Mayor Aldric" />
      </label>

      <label className="field">
        <span>Handwritten note</span>
        <textarea
          {...note}
          className="note-input"
          maxLength={2000}
          rows={4}
          placeholder="Scribble what the players know…"
        />
      </label>

      <label className="field">
        <span>Image URL</span>
        <input {...imageUrl} placeholder="https://cdn.discordapp.com/…" />
      </label>
      {card.imageUrl && (
        <img
          className="photo-thumb"
          src={card.imageUrl}
          alt=""
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      )}

      <div className="field">
        <span>Notepad</span>
        <button
          type="button"
          className="btn"
          onClick={() => onOpenNotepad(card.id)}
        >
          Open notepad{card.notepad.length > 0 ? ` (${card.notepad.length})` : ""}
        </button>
      </div>

      <label className="field">
        <span>Tilt ({card.rotation}°)</span>
        <input
          type="range"
          min={-15}
          max={15}
          value={card.rotation}
          onChange={(e) => save({ rotation: Number(e.target.value) })}
        />
      </label>

      <button
        type="button"
        className="btn btn--danger"
        onClick={() => onDelete(card.id)}
      >
        Delete card
      </button>
    </div>
  );
}

interface ConnInspectorProps {
  boardId: string;
  connection: Connection;
  onDelete: (id: string) => void;
}

export function ConnectionInspector({
  boardId,
  connection,
  onDelete,
}: ConnInspectorProps) {
  const save = (patch: Parameters<typeof api.updateConnection>[2]) =>
    void api.updateConnection(boardId, connection.id, patch).catch(() => {});

  const label = useCommittedField(connection.label, (value) => save({ label: value }));

  return (
    <div className="inspector">
      <div className="inspector-head">
        <h3>String</h3>
        <RevealToggle
          revealed={connection.revealed}
          onChange={(revealed) => save({ revealed })}
        />
      </div>

      <label className="field">
        <span>Note on the string</span>
        <input {...label} maxLength={200} placeholder="e.g. blackmailed by" />
      </label>

      <div className="field">
        <span>Colour</span>
        <div className="swatches">
          {STRING_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${connection.color === c ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => save({ color: c })}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn btn--danger"
        onClick={() => onDelete(connection.id)}
      >
        Cut string
      </button>
    </div>
  );
}

function RevealToggle({
  revealed,
  onChange,
}: {
  revealed: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`reveal-toggle ${revealed ? "is-on" : ""}`}
      onClick={() => onChange(!revealed)}
      title={revealed ? "Visible to players" : "Hidden from players"}
    >
      {revealed ? "👁 Revealed" : "🚫 Hidden"}
    </button>
  );
}
