import styled, { css } from "styled-components";
import type { Card, Connection } from "@board/shared";
import { tackAnchor } from "./layout";

interface Props {
  connections: Connection[];
  cards: Record<string, Card>;
  editable: boolean;
  selectedId: string | null;
  pending: { fromCardId: string; toX: number; toY: number } | null;
  onSelect: (id: string) => void;
  /**
   * "hit" draws only the invisible click targets and is rendered *below* the
   * cards, so a string never steals a click from the thumbtack it anchors to.
   * "art" draws the visible strings and their tags, above the cards.
   */
  layer: "hit" | "art";
}

const MAX_SAG = 60;
const SAG_RATIO = 0.18;

interface Point {
  x: number;
  y: number;
}

function stringGeometry(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sag = Math.min(MAX_SAG, Math.hypot(dx, dy) * SAG_RATIO); // gravity droop
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // A quadratic's tangent at t=0.5 is parallel to its chord, so the tag can
  // simply follow the chord's angle — flipped to stay right-side up.
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  else if (angle < -90) angle += 180;
  return {
    d: `M ${a.x} ${a.y} Q ${mx} ${my + sag} ${b.x} ${b.y}`,
    // The curve's own midpoint: B(0.5) = chord midpoint + half the sag.
    tag: { x: mx, y: my + sag / 2, angle },
  };
}

export function StringLayer({
  connections,
  cards,
  editable,
  selectedId,
  pending,
  onSelect,
  layer,
}: Props) {
  // A large, offset canvas so strings never clip and negative board
  // coordinates are covered; the viewBox re-centers board-space origin.
  const SPAN = 20000;
  const HALF = SPAN / 2;
  return (
    <StyledStringLayer
      $art={layer === "art"}
      style={{ left: -HALF, top: -HALF, width: SPAN, height: SPAN }}
      viewBox={`${-HALF} ${-HALF} ${SPAN} ${SPAN}`}
      aria-hidden="true"
    >
      {connections.map((conn) => {
        const from = cards[conn.fromCardId];
        const to = cards[conn.toCardId];
        if (!from || !to) return null;
        const { d, tag } = stringGeometry(
          tackAnchor(from.x, from.y),
          tackAnchor(to.x, to.y),
        );
        return (
          <StyledStringGroup key={conn.id} $selected={selectedId === conn.id}>
            {/* Wide invisible hit area for easy selection */}
            {layer === "hit" && editable && (
              <StyledStringHit
                d={d}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(conn.id);
                }}
              />
            )}
            {layer === "art" && (
              <StyledString d={d} $hidden={!conn.revealed} stroke={conn.color} />
            )}
            {layer === "art" && conn.label && (
              <StyledStringTag
                transform={`translate(${tag.x}, ${tag.y}) rotate(${tag.angle})`}
                onPointerDown={
                  editable
                    ? (e) => {
                        e.stopPropagation();
                        onSelect(conn.id);
                      }
                    : undefined
                }
              >
                <StyledStringTagBg
                  x={-Math.max(28, conn.label.length * 4.4)}
                  y={-11}
                  width={Math.max(56, conn.label.length * 8.8)}
                  height={22}
                  rx={3}
                />
                <StyledStringTagText textAnchor="middle" dominantBaseline="central">
                  {conn.label}
                </StyledStringTagText>
              </StyledStringTag>
            )}
          </StyledStringGroup>
        );
      })}

      {layer === "art" && pending && cards[pending.fromCardId] && (
        <StyledPendingString
          d={
            stringGeometry(
              tackAnchor(cards[pending.fromCardId].x, cards[pending.fromCardId].y),
              { x: pending.toX, y: pending.toY },
            ).d
          }
        />
      )}
    </StyledStringLayer>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

const StyledStringLayer = styled.svg<{ $art: boolean }>`
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  pointer-events: none;
  /* Visible strings hang in front of the cards; their click targets stay behind
     them (default z-index) so a string can't cover the tack it hangs from. */
  ${(p) =>
    p.$art &&
    css`
      z-index: 2;
    `}
`;

const string = css`
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.35));
`;

const StyledString = styled.path<{ $hidden: boolean }>`
  ${string}
  ${(p) =>
    p.$hidden &&
    css`
      stroke-dasharray: 6 6;
      opacity: 0.5;
    `}
`;

const StyledPendingString = styled.path`
  ${string}
  stroke: #fff;
  stroke-dasharray: 4 6;
  opacity: 0.85;
`;

const StyledStringHit = styled.path`
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  pointer-events: stroke;
  cursor: pointer;
`;

const StyledStringGroup = styled.g<{ $selected: boolean }>`
  ${(p) =>
    p.$selected &&
    css`
      ${StyledString} {
        stroke-width: 4;
      }
    `}
`;

const StyledStringTag = styled.g`
  pointer-events: auto;
  cursor: pointer;
`;

const StyledStringTagBg = styled.rect`
  fill: #fff8e7;
  stroke: #cbbb95;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
`;

const StyledStringTagText = styled.text`
  font-family: var(--hand);
  font-size: 15px;
  fill: #4a3b26;
`;
