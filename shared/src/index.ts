// Shared domain + API types used by both the client and server.

export type Role = "gm" | "player";

export interface User {
  id: string; // Discord user id
  username: string;
  avatar: string | null; // Discord avatar hash
}

/** The current session's identity. Any signed-in user may create boards. */
export interface Me {
  user: User;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  role: Role; // the requesting user's role on this board
}

/** A single line on a card's notepad, revealed to players one at a time. */
export interface Tidbit {
  id: string;
  text: string;
  revealed: boolean;
}

/** The dotted rectangle a group's card heads. Its position is derived from the
 *  card's, so only the size is stored. */
export interface Frame {
  width: number;
  height: number;
}

/** A card pinned to the board. */
export interface Card {
  id: string;
  boardId: string;
  title: string;
  note: string; // handwritten caption
  imageUrl: string | null; // hotlinked image URL (we never host the bytes)
  x: number;
  y: number;
  rotation: number; // degrees
  revealed: boolean;
  // Lined-notepaper tidbits tucked under the card. Ordered; the server
  // returns this already role-filtered (players get only revealed tidbits).
  notepad: Tidbit[];
  /** The group card this one sits inside, if any. Players never receive it for
   *  a group whose own card is hidden from them. */
  groupId: string | null;
  /** Non-null means this card *is* a group: it wears the nameplate at the top of
   *  a frame drawn around its members. */
  frame: Frame | null;
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

/** The two ends of a string. */
export interface CardPair {
  fromCardId: string;
  toCardId: string;
}

/**
 * Strings are undirected: A→B and B→A are the same string. Nothing renders a
 * direction — the curve sags from the midpoint and carries no arrowhead — so
 * two such rows would draw the identical line. One string per pair is the rule
 * the client, the API and a unique index all enforce; this is its definition.
 */
export function samePair(a: CardPair, b: CardPair): boolean {
  return (
    (a.fromCardId === b.fromCardId && a.toCardId === b.toCardId) ||
    (a.fromCardId === b.toCardId && a.toCardId === b.fromCardId)
  );
}

/** The string already tied between `pair`'s two cards, if there is one. */
export function findStringBetween<T extends CardPair>(
  connections: T[],
  pair: CardPair,
): T | undefined {
  return connections.find((c) => samePair(c, pair));
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
  imageUrl?: string | null;
  x: number;
  y: number;
  rotation?: number;
  revealed?: boolean;
  groupId?: string | null;
  frame?: Frame | null;
}

export type UpdateCardInput = Partial<
  Pick<
    Card,
    | "title"
    | "note"
    | "imageUrl"
    | "x"
    | "y"
    | "rotation"
    | "revealed"
    | "groupId"
    | "frame"
  >
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

export interface CreateTidbitInput {
  text?: string;
}

export type UpdateTidbitInput = Partial<Pick<Tidbit, "text" | "revealed">>;

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
