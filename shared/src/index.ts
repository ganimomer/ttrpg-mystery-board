// Shared domain + API types used by both the client and server.

export type Role = "gm" | "player";

export interface User {
  id: string; // Discord user id
  username: string;
  avatar: string | null; // Discord avatar hash
}

/** The current session's view of who they are on a given board. */
export interface Me {
  user: User;
  isGameMaster: boolean; // present in the GM allowlist (may create boards / upload)
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  role: Role; // the requesting user's role on this board
}

/** A Polaroid card pinned to the board. */
export interface Card {
  id: string;
  boardId: string;
  title: string;
  note: string; // handwritten caption
  imageId: string | null;
  x: number;
  y: number;
  rotation: number; // degrees
  revealed: boolean;
}

/** A string tied between two cards, denoting a relationship. */
export interface Connection {
  id: string;
  boardId: string;
  fromCardId: string;
  toCardId: string;
  label: string; // the little note tied to the string
  color: string; // string color (hex)
  revealed: boolean;
}

/** Everything needed to render a board in one payload. */
export interface BoardSnapshot {
  board: Board;
  cards: Card[];
  connections: Connection[];
}

// ─── Request payloads ────────────────────────────────────────────

export interface CreateBoardInput {
  name: string;
}

export interface CreateCardInput {
  title?: string;
  note?: string;
  imageId?: string | null;
  x: number;
  y: number;
  rotation?: number;
  revealed?: boolean;
}

export type UpdateCardInput = Partial<
  Pick<Card, "title" | "note" | "imageId" | "x" | "y" | "rotation" | "revealed">
>;

export interface CreateConnectionInput {
  fromCardId: string;
  toCardId: string;
  label?: string;
  color?: string;
  revealed?: boolean;
}

export type UpdateConnectionInput = Partial<
  Pick<Connection, "label" | "color" | "revealed">
>;

export interface ImageMeta {
  id: string;
  boardId: string;
  width: number;
  height: number;
  mime: string;
}

export interface Invite {
  token: string;
  boardId: string;
  url: string;
  expiresAt: string; // ISO
}

// ─── Realtime (SSE) events ───────────────────────────────────────
// The server tailors these per subscriber: players never receive events
// for hidden items. A card/connection that is un-revealed for a player is
// delivered as a `*.removed` event (or simply never sent).

export type BoardEvent =
  | { type: "card.upserted"; card: Card }
  | { type: "card.removed"; cardId: string }
  | { type: "connection.upserted"; connection: Connection }
  | { type: "connection.removed"; connectionId: string }
  | { type: "board.renamed"; name: string };
