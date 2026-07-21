import { describe, expect, it } from "vitest";
import type { BoardEvent, Card, Connection } from "@board/shared";
import {
  publishCardRemove,
  publishCardUpsert,
  publishConnectionUpsert,
  subscribe,
} from "../realtime/bus.js";

function collector() {
  const events: BoardEvent[] = [];
  return { events, send: (e: BoardEvent) => events.push(e) };
}

function card(revealed: boolean): Card {
  return {
    id: "card1",
    boardId: "board1",
    title: "Secret",
    note: "",
    imageId: null,
    x: 0,
    y: 0,
    rotation: 0,
    revealed,
  };
}

describe("realtime bus reveal filtering", () => {
  it("sends hidden card upserts to the GM but a removal to players", () => {
    const gm = collector();
    const player = collector();
    const offGm = subscribe("board1", { role: "gm", send: gm.send });
    const offPlayer = subscribe("board1", { role: "player", send: player.send });

    publishCardUpsert(card(false));

    expect(gm.events).toEqual([{ type: "card.upserted", card: card(false) }]);
    expect(player.events).toEqual([{ type: "card.removed", cardId: "card1" }]);

    offGm();
    offPlayer();
  });

  it("sends revealed card upserts to everyone", () => {
    const gm = collector();
    const player = collector();
    const offGm = subscribe("board1", { role: "gm", send: gm.send });
    const offPlayer = subscribe("board1", { role: "player", send: player.send });

    publishCardUpsert(card(true));

    expect(gm.events[0]).toEqual({ type: "card.upserted", card: card(true) });
    expect(player.events[0]).toEqual({ type: "card.upserted", card: card(true) });

    offGm();
    offPlayer();
  });

  it("does not leak a hidden connection's data to players", () => {
    const player = collector();
    const off = subscribe("board1", { role: "player", send: player.send });
    const hidden: Connection = {
      id: "c1",
      boardId: "board1",
      fromCardId: "a",
      toCardId: "b",
      label: "blackmails",
      color: "#000000",
      revealed: false,
    };

    publishConnectionUpsert(hidden);

    expect(player.events).toEqual([
      { type: "connection.removed", connectionId: "c1" },
    ]);
    // The sensitive label never reached the player.
    expect(JSON.stringify(player.events)).not.toContain("blackmails");
    off();
  });

  it("delivers removals to all roles", () => {
    const gm = collector();
    const player = collector();
    const offGm = subscribe("board1", { role: "gm", send: gm.send });
    const offPlayer = subscribe("board1", { role: "player", send: player.send });

    publishCardRemove("board1", "card1");

    expect(gm.events).toContainEqual({ type: "card.removed", cardId: "card1" });
    expect(player.events).toContainEqual({
      type: "card.removed",
      cardId: "card1",
    });
    offGm();
    offPlayer();
  });
});
