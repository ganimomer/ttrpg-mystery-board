import { describe, expect, it } from "vitest";
import type { Card, Connection } from "@board/shared";
import { visibleCards, visibleConnections } from "../reveal.js";

function card(id: string, revealed: boolean): Card {
  return {
    id,
    boardId: "b",
    title: id,
    note: "",
    imageUrl: null,
    x: 0,
    y: 0,
    rotation: 0,
    revealed,
    notepad: [],
  };
}

function conn(
  id: string,
  from: string,
  to: string,
  revealed: boolean,
): Connection {
  return {
    id,
    boardId: "b",
    fromCardId: from,
    toCardId: to,
    label: "",
    color: "#000000",
    revealed,
  };
}

describe("visibleCards", () => {
  const cards = [card("a", true), card("b", false), card("c", true)];

  it("gives the GM everything", () => {
    expect(visibleCards(cards, "gm")).toHaveLength(3);
  });

  it("hides un-revealed cards from players", () => {
    const seen = visibleCards(cards, "player");
    expect(seen.map((c) => c.id).sort()).toEqual(["a", "c"]);
    expect(seen.some((c) => !c.revealed)).toBe(false);
  });
});

describe("visibleConnections", () => {
  const cards = [card("a", true), card("b", false), card("c", true)];
  const connections = [
    conn("1", "a", "c", true), // both endpoints visible + revealed
    conn("2", "a", "c", false), // revealed=false → hidden from players
    conn("3", "a", "b", true), // endpoint b hidden → hidden from players
  ];

  it("gives the GM every connection", () => {
    expect(visibleConnections(connections, new Set(), "gm")).toHaveLength(3);
  });

  it("only shows players revealed connections between visible cards", () => {
    const visibleIds = new Set(
      visibleCards(cards, "player").map((c) => c.id),
    );
    const seen = visibleConnections(connections, visibleIds, "player");
    expect(seen.map((c) => c.id)).toEqual(["1"]);
  });
});
