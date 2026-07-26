import type { Card, Connection } from "@board/shared";
import { tackAnchor } from "./layout";

interface Props {
  connections: Connection[];
  cards: Record<string, Card>;
  editable: boolean;
  selectedId: string | null;
  pending: { fromCardId: string; toX: number; toY: number } | null;
  onSelect: (id: string) => void;
}

function sagPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag = Math.min(60, dist * 0.18); // gravity droop
  return `M ${x1} ${y1} Q ${mx} ${my + sag} ${x2} ${y2}`;
}

export function StringLayer({
  connections,
  cards,
  editable,
  selectedId,
  pending,
  onSelect,
}: Props) {
  // A large, offset canvas so strings never clip and negative board
  // coordinates are covered. The inner <g> re-centers board-space origin.
  const SPAN = 20000;
  const HALF = SPAN / 2;
  return (
    <svg
      className="string-layer"
      style={{ left: -HALF, top: -HALF, width: SPAN, height: SPAN }}
      viewBox={`${-HALF} ${-HALF} ${SPAN} ${SPAN}`}
      aria-hidden="true"
    >
      {connections.map((conn) => {
        const from = cards[conn.fromCardId];
        const to = cards[conn.toCardId];
        if (!from || !to) return null;
        const a = tackAnchor(from.x, from.y);
        const b = tackAnchor(to.x, to.y);
        const d = sagPath(a.x, a.y, b.x, b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 + Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.18) / 2;
        const dim = conn.revealed ? "" : "string--hidden";
        return (
          <g key={conn.id} className={selectedId === conn.id ? "string--selected" : ""}>
            {/* Wide invisible hit area for easy selection */}
            {editable && (
              <path
                d={d}
                className="string-hit"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(conn.id);
                }}
              />
            )}
            <path d={d} className={`string ${dim}`} stroke={conn.color} />
            {conn.label && (
              <g
                transform={`translate(${mx}, ${my})`}
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

      {pending && cards[pending.fromCardId] && (
        <path
          d={(() => {
            const a = tackAnchor(
              cards[pending.fromCardId].x,
              cards[pending.fromCardId].y,
            );
            return sagPath(a.x, a.y, pending.toX, pending.toY);
          })()}
          className="string string--pending"
        />
      )}
    </svg>
  );
}
