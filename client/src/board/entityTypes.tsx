import styled from "styled-components";
import type { Card, EntityType } from "@board/shared";
import { BusinessCenterIcon, GroupIcon, PersonIcon, PlaceIcon } from "./icons";

/**
 * What a card is, as the board draws it. Four kinds, but only three are stored:
 * a card carrying a frame *is* a group, so that kind is read off the frame and
 * can never be picked, changed or contradicted.
 */
export type CardKind = EntityType | "group";

/** The kind a card is drawn as, or null while the GM has not said. */
export function cardKind(card: Card): CardKind | null {
  return card.frame ? "group" : card.entityType;
}

/**
 * One ink per kind. The paper's tint is not listed: it is mixed from the same
 * ink in CSS (see `typeVars`), so "a lighter shade of the icon's colour" is
 * stated once and cannot drift apart from the icon.
 *
 * Muted on purpose — these wash over every card at once, and have to sit under
 * the red accent and the string colours without shouting at them.
 */
export const KINDS: Record<
  CardKind,
  { label: string; ink: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  person: { label: "Person", ink: "#2f6f9e", Icon: PersonIcon },
  thing: { label: "Thing", ink: "#9c6b28", Icon: BusinessCenterIcon },
  place: { label: "Place", ink: "#2f7d57", Icon: PlaceIcon },
  group: { label: "Group", ink: "#7a4a8c", Icon: GroupIcon },
};

/** The three a GM may choose between, in the order the pill lays them out. */
export const CHOICES: EntityType[] = ["person", "thing", "place"];

/**
 * The two custom properties every drawing of a card sets, so each face can mix
 * its own stock with the kind's ink rather than carrying a table of tints:
 *
 *   background-color: color-mix(in srgb, var(--type-ink) var(--type-mix), <paper>);
 *
 * An untyped card mixes 0% and lands back on its plain paper exactly — one code
 * path, no "if untyped" branch, and `transition: background-color` then animates
 * the wash on and off for free.
 */
export function typeVars(card: Card): React.CSSProperties {
  const kind = cardKind(card);
  return {
    "--type-ink": kind ? KINDS[kind].ink : "transparent",
    "--type-mix": kind ? "12%" : "0%",
  } as React.CSSProperties;
}

/** The kind's glyph in its own ink — what a card wears when nobody is editing it. */
export function TypeIcon({
  kind,
  size = 18,
  title,
}: {
  kind: CardKind;
  size?: number;
  title?: string;
}) {
  const { label, ink, Icon } = KINDS[kind];
  return (
    <StyledTypeIcon
      style={{ color: ink }}
      title={title ?? label}
      role="img"
      aria-label={label}
    >
      <Icon size={size} />
    </StyledTypeIcon>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

/* Only carries the ink down to the glyph, which fills with `currentColor`. */
const StyledTypeIcon = styled.span`
  display: block;
  transition: color 200ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
