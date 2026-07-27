import styled, { css } from "styled-components";
import type { Card, Tidbit } from "@board/shared";
import { api } from "../api";
import { StyledButton } from "../ui/Button";
import { StyledInput } from "../ui/Field";
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
    <StyledFocusPad>
      <StyledNotepadLines>
        {items.length === 0 && (
          <StyledNotepadEmpty>Add a line to start the notepad.</StyledNotepadEmpty>
        )}
        {items.map((t) => (
          <StyledNotepadLine key={t.id} $hidden={!t.revealed}>
            {editable ? (
              <TidbitLine
                tidbit={t}
                onSave={(patch) => save(t.id, patch)}
                onDelete={() =>
                  void api.deleteTidbit(boardId, card.id, t.id).catch(() => {})
                }
              />
            ) : (
              <StyledLineTextStatic>{t.text}</StyledLineTextStatic>
            )}
          </StyledNotepadLine>
        ))}
      </StyledNotepadLines>

      {editable && (
        <StyledNotepadActions>
          <StyledButton
            onClick={() => void api.addTidbit(boardId, card.id, {}).catch(() => {})}
          >
            + Add a line
          </StyledButton>
          <StyledPaleGhostButton
            $variant="ghost"
            disabled={!firstHidden}
            title="Reveal the next hidden tidbit"
            onClick={() => firstHidden && save(firstHidden.id, { revealed: true })}
          >
            Reveal next
          </StyledPaleGhostButton>
        </StyledNotepadActions>
      )}
    </StyledFocusPad>
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
      <StyledLineEye
        type="button"
        title={tidbit.revealed ? "Revealed to players" : "Hidden from players"}
        aria-label={tidbit.revealed ? "Hide this line" : "Show this line"}
        onClick={() => onSave({ revealed: !tidbit.revealed })}
      >
        {tidbit.revealed ? <VisibilityIcon size={17} /> : <VisibilityOffIcon size={17} />}
      </StyledLineEye>
      <StyledLineText {...text} maxLength={2000} placeholder="a tidbit…" />
      <StyledLineDel type="button" title="Delete line" onClick={onDelete}>
        ×
      </StyledLineDel>
    </>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* The notepad, unfolded: the pad that was peeking out from behind the card.
   CardFocus fades it in once the card has landed, so it exports itself. */
export const StyledFocusPad = styled.div`
  padding: 18px 20px 16px;
  border-radius: 3px;
  /* Leans with the card, plus a hair of its own — two loose sheets, not one. */
  transform: rotate(calc(var(--tilt, 0) * 1deg + 0.9deg));
  color: #33302a;
  background-color: #fdf6b2;
  background-image:
    linear-gradient(90deg, transparent 40px, #f6c6c0 40px, #f6c6c0 41px, transparent 41px),
    repeating-linear-gradient(#fdf6b2 0 27px, #cdd9e6 27px 28px);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.45);
`;

/* The pad is pale, so the quiet button has to go dark-on-light on it. */
const StyledPaleGhostButton = styled(StyledButton)`
  background: rgba(51, 48, 42, 0.1);
  color: #4a4436;
`;

const StyledNotepadLines = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledNotepadLine = styled.li<{ $hidden: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding-left: 46px;
  opacity: ${(p) => (p.$hidden ? 0.5 : 1)};
`;

const StyledNotepadEmpty = styled.li`
  padding-left: 46px;
  font-family: var(--hand);
  font-size: 20px;
  color: #8a7f5f;
`;

const lineButton = css`
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px;
  font-size: 15px;
  line-height: 1;
  flex: none;
  display: grid;
  place-items: center;
`;

/* An unrevealed line is already dimmed as a whole; the icon carries the state,
   so the button itself looks the same either way. */
const StyledLineEye = styled.button`
  ${lineButton}
  color: #4a4436;
`;

const StyledLineDel = styled.button`
  ${lineButton}
  color: #b0341d;
  font-size: 18px;
`;

/* Handwriting on a ruled line rather than a boxed field — but it keeps the
   shared field's rounded corner, which only shows once focus tints it. */
const StyledLineText = styled(StyledInput)`
  flex: 1;
  border: none;
  background: transparent;
  padding: 2px 0;
  font-family: var(--hand);
  font-size: 21px;
  color: #2b2820;

  &:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.4);
  }
`;

const StyledLineTextStatic = styled.span`
  flex: 1;
  font-family: var(--hand);
  font-size: 21px;
  line-height: 1.25;
`;

const StyledNotepadActions = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 0 0 46px;
`;
