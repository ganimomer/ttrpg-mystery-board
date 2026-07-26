import { useEffect, useRef, useState } from "react";
import type { Card, Connection } from "@board/shared";
import { api } from "../api";

const STRING_COLORS = ["#c0392b", "#2c3e50", "#27ae60", "#8e44ad", "#d35400", "#16a085"];

interface CardInspectorProps {
  boardId: string;
  card: Card;
  onDelete: (id: string) => void;
}

export function CardInspector({ boardId, card, onDelete }: CardInspectorProps) {
  const [title, setTitle] = useState(card.title);
  const [note, setNote] = useState(card.note);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reseed when a different card is selected.
  useEffect(() => {
    setTitle(card.title);
    setNote(card.note);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (patch: Parameters<typeof api.updateCard>[2]) =>
    void api.updateCard(boardId, card.id, patch).catch(() => {});

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const img = await api.uploadImage(boardId, file);
      await api.updateCard(boardId, card.id, { imageId: img.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="inspector">
      <div className="inspector-head">
        <h3>Polaroid</h3>
        <RevealToggle
          revealed={card.revealed}
          onChange={(revealed) => save({ revealed })}
        />
      </div>

      <label className="field">
        <span>Title</span>
        <input
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== card.title && save({ title })}
          placeholder="e.g. Mayor Aldric"
        />
      </label>

      <label className="field">
        <span>Handwritten note</span>
        <textarea
          className="note-input"
          value={note}
          maxLength={2000}
          rows={4}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== card.note && save({ note })}
          placeholder="Scribble what the players know…"
        />
      </label>

      <div className="field">
        <span>Photo</span>
        <div className="photo-row">
          {card.imageId && (
            <img className="photo-thumb" src={api.imageUrl(card.imageId)} alt="" />
          )}
          <button
            type="button"
            className="btn"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : card.imageId ? "Replace" : "Upload photo"}
          </button>
          {card.imageId && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => save({ imageId: null })}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={onFile}
        />
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
  const [label, setLabel] = useState(connection.label);
  useEffect(() => setLabel(connection.label), [connection.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (patch: Parameters<typeof api.updateConnection>[2]) =>
    void api.updateConnection(boardId, connection.id, patch).catch(() => {});

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
        <input
          value={label}
          maxLength={200}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== connection.label && save({ label })}
          placeholder="e.g. blackmailed by"
        />
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
