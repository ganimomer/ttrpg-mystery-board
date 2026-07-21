import type { Card, Connection } from "@board/shared";
import type { schema } from "./db/index.js";

type CardRow = typeof schema.cards.$inferSelect;
type ConnectionRow = typeof schema.connections.$inferSelect;

export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    note: row.note,
    imageId: row.imageId,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    revealed: row.revealed,
  };
}

export function toConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    boardId: row.boardId,
    fromCardId: row.fromCardId,
    toCardId: row.toCardId,
    label: row.label,
    color: row.color,
    revealed: row.revealed,
  };
}
