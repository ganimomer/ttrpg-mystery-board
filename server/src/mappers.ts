import type { Card, Connection, Tidbit } from "@board/shared";
import type { schema } from "./db/index.js";

type CardRow = typeof schema.cards.$inferSelect;
type ConnectionRow = typeof schema.connections.$inferSelect;
type NoteItemRow = typeof schema.noteItems.$inferSelect;

export function toTidbit(row: NoteItemRow): Tidbit {
  return { id: row.id, text: row.text, revealed: row.revealed };
}

export function toCard(row: CardRow, notepad: Tidbit[] = []): Card {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    note: row.note,
    imageUrl: row.imageUrl,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    revealed: row.revealed,
    entityType: row.entityType,
    notepad,
    groupId: row.groupId,
    // Two columns, one concept: a size means this card heads a group.
    frame:
      row.frameWidth !== null && row.frameHeight !== null
        ? { width: row.frameWidth, height: row.frameHeight }
        : null,
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
