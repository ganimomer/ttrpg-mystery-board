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
    <svg
      className={`string-layer string-layer--${layer}`}
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
        const dim = conn.revealed ? "" : "string--hidden";
        return (
          <g key={conn.id} className={selectedId === conn.id ? "string--selected" : ""}>
            {/* Wide invisible hit area for easy selection */}
            {layer === "hit" && editable && (
              <path
                d={d}
                className="string-hit"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(conn.id);
                }}
              />
            )}
            {layer === "art" && (
              <path d={d} className={`string ${dim}`} stroke={conn.color} />
            )}
            {layer === "art" && conn.label && (
              <g
                transform={`translate(${tag.x}, ${tag.y}) rotate(${tag.angle})`}
                className="string-tag"
                onPointerDown={
                  editable
                    ? (e) => {
                        e.stopPropagation();
                        onSelect(conn.id);
                      }
                    : undefined
                }
              >
                <rect
                  x={-Math.max(28, conn.label.length * 4.4)}
                  y={-11}
                  width={Math.max(56, conn.label.length * 8.8)}
                  height={22}
                  rx={3}
                  className="string-tag-bg"
                />
                <text textAnchor="middle" dominantBaseline="central" className="string-tag-text">
                  {conn.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {layer === "art" && pending && cards[pending.fromCardId] && (
        <path
          d={
            stringGeometry(
              tackAnchor(cards[pending.fromCardId].x, cards[pending.fromCardId].y),
              { x: pending.toX, y: pending.toY },
            ).d
          }
          className="string string--pending"
        />
      )}
    </svg>
  );
}
