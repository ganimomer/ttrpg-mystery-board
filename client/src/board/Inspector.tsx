import styled from "styled-components";
import type { Connection } from "@board/shared";
import { api } from "../api";
import { StyledButton } from "../ui/Button";
import { StyledInput } from "../ui/Field";
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
    <StyledInspector>
      <StyledInspectorHead>
        <h3>String</h3>
        <RevealToggle
          revealed={connection.revealed}
          onChange={(revealed) => save({ revealed })}
        />
      </StyledInspectorHead>

      <StyledField as="label">
        <span>Note on the string</span>
        <StyledInput {...label} maxLength={200} placeholder="e.g. blackmailed by" />
      </StyledField>

      <StyledField>
        <span>Colour</span>
        <StyledSwatches>
          {STRING_COLORS.map((c) => (
            <StyledSwatch
              key={c}
              type="button"
              aria-pressed={connection.color === c}
              style={{ background: c }}
              onClick={() => save({ color: c })}
              aria-label={c}
            />
          ))}
        </StyledSwatches>
      </StyledField>

      <StyledButton
        type="button"
        $variant="danger"
        onClick={() => onDelete(connection.id)}
      >
        Cut string
      </StyledButton>
    </StyledInspector>
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
    <StyledRevealToggle
      type="button"
      aria-pressed={revealed}
      onClick={() => onChange(!revealed)}
      title={revealed ? "Visible to players" : "Hidden from players"}
    >
      {revealed ? <VisibilityIcon size={17} /> : <VisibilityOffIcon size={17} />}
      {revealed ? "Revealed" : "Hidden"}
    </StyledRevealToggle>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

const StyledInspector = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const StyledInspectorHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-family: var(--hand);
    font-size: 24px;
  }
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #6b5c44;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

/* Both toggles below read their own pressed state, so the state lives in the
   ARIA attribute the button needs anyway rather than in a second class. */
const StyledRevealToggle = styled.button`
  border: none;
  border-radius: 20px;
  padding: 6px 12px 6px 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: #e0d4bd;
  color: #6b5c44;

  &[aria-pressed="true"] {
    background: #2d9c5a;
    color: white;
  }
`;

const StyledSwatches = styled.div`
  display: flex;
  gap: 8px;
`;

const StyledSwatch = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;

  &[aria-pressed="true"] {
    border-color: var(--ink);
    transform: scale(1.12);
  }
`;
