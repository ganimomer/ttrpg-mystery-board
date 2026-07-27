import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Discord user id
  username: text("username").notNull(),
  avatar: text("avatar"),
  createdAt: createdAt(),
});

export const boards = pgTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const boardMembers = pgTable(
  "board_members",
  {
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["gm", "player"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.userId] })],
);

export const invites = pgTable("invites", {
  token: text("token").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    note: text("note").notNull().default(""),
    imageUrl: text("image_url"),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    rotation: integer("rotation").notNull().default(0),
    revealed: boolean("revealed").notNull().default(false),
    // Groups: a card with a frame *is* a group, and `group_id` is the card that
    // heads the group this one sits in. Deleting a group's card releases its
    // members rather than taking them with it (SET NULL, in bootstrapSchema).
    groupId: text("group_id"),
    frameWidth: integer("frame_width"),
    frameHeight: integer("frame_height"),
    createdAt: createdAt(),
  },
  (t) => [index("cards_board_idx").on(t.boardId), index("cards_group_idx").on(t.groupId)],
);

export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    fromCardId: text("from_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    toCardId: text("to_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    color: text("color").notNull().default("#c0392b"),
    revealed: boolean("revealed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("connections_board_idx").on(t.boardId)],
);

export const noteItems = pgTable(
  "note_items",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    revealed: boolean("revealed").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("note_items_card_idx").on(t.cardId)],
);
