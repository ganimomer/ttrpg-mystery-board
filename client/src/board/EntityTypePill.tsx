import { useRef } from "react";
import styled from "styled-components";
import type { EntityType } from "@board/shared";
import { CHOICES, KINDS } from "./entityTypes";

/** Both the height of the pill and the diameter of the circle that runs in it. */
const SLOT = 30;

interface Props {
  value: EntityType | null;
  onChange: (type: EntityType) => void;
}

/**
 * What this card is, as a row of glyphs in a sunken pill with one filled circle
 * running between them. A radio group in every way that matters — one of the
 * three is true at a time, arrow keys walk it — drawn as the thing it does:
 * the circle slides to the kind you pick and takes its colour with it, in step
 * with the wash of the same colour spreading through the card behind it.
 *
 * A card starts untyped, and there is no way back to that: the circle grows in
 * on the first pick and thereafter only moves.
 */
export function EntityTypePill({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const index = value ? CHOICES.indexOf(value) : 0;

  // Arrow keys select as they move, as a radio group does — and the button they
  // land on has to be focused too, or the roving tabindex leaves focus behind.
  function onKeyDown(e: React.KeyboardEvent) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + CHOICES.length) % CHOICES.length;
    onChange(CHOICES[next]);
    ref.current?.querySelectorAll("button")[next]?.focus();
  }

  return (
    <StyledPill ref={ref} role="radiogroup" aria-label="What this card is" onKeyDown={onKeyDown}>
      {/* The circle takes `--type-ink` from the card it sits on, so there is one
          colour between the two and it changes for both at once. */}
      <StyledPillKnob
        aria-hidden="true"
        $shown={value !== null}
        style={{
          transform: `translateX(${index * SLOT}px) scale(${value ? 1 : 0.4})`,
        }}
      />
      {CHOICES.map((kind, i) => {
        const { label, Icon } = KINDS[kind];
        const selected = value === kind;
        return (
          <StyledPillChoice
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            // One stop for the whole group: whichever is on, or the first when
            // none is.
            tabIndex={selected || (value === null && i === 0) ? 0 : -1}
            $selected={selected}
            onClick={() => onChange(kind)}
          >
            <Icon size={17} />
          </StyledPillChoice>
        );
      })}
    </StyledPill>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* Sunk into the card's frame rather than laid on top of it — a groove the
   circle runs in, not a toolbar that happens to be sitting there. */
const StyledPill = styled.div`
  position: relative;
  display: flex;
  width: ${SLOT * 3}px;
  height: ${SLOT}px;
  border-radius: 999px;
  background: rgba(90, 74, 46, 0.1);
  box-shadow: inset 0 1px 2px rgba(90, 74, 46, 0.16);
`;

/* Grows in on the first pick, and slides from then on. `transform` and colour
   share a duration with the card's tint so the whole change reads as one move. */
const StyledPillKnob = styled.div<{ $shown: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${SLOT}px;
  height: ${SLOT}px;
  border-radius: 50%;
  background: var(--type-ink);
  box-shadow: 0 2px 5px rgba(20, 14, 8, 0.35);
  opacity: ${(p) => (p.$shown ? 1 : 0)};
  transition: transform 200ms cubic-bezier(0.3, 0.9, 0.35, 1),
    background-color 200ms ease, opacity 160ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledPillChoice = styled.button<{ $selected: boolean }>`
  position: relative;
  z-index: 1; /* over the circle, so the chosen glyph is knocked out of it */
  width: ${SLOT}px;
  height: ${SLOT}px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: ${(p) => (p.$selected ? "#fff" : "rgba(90, 74, 46, 0.55)")};
  transition: color 200ms ease;

  &:hover {
    color: ${(p) => (p.$selected ? "#fff" : "rgba(90, 74, 46, 0.9)")};
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
