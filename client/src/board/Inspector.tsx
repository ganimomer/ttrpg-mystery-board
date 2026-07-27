import type { Connection } from "@board/shared";
import { api } from "../api";
import { VisibilityIcon, VisibilityOffIcon } from "./icons";
import { useCommittedField } from "./useCommittedField";

const STRING_COLORS = ["#c0392b", "#2c3e50", "#27ae60", "#8e44ad", "#d35400", "#16a085"];

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
      {revealed ? <VisibilityIcon size={17} /> : <VisibilityOffIcon size={17} />}
      {revealed ? "Revealed" : "Hidden"}
    </button>
  );
}
