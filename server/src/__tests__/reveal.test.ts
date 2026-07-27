import { describe, expect, it } from "vitest";
import type { Card, Connection } from "@board/shared";
import { stripHiddenGroups, visibleCards, visibleConnections } from "../reveal.js";

function card(id: string, revealed: boolean, extra: Partial<Card> = {}): Card {
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
    groupId: null,
    frame: null,
    ...extra,
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

describe("stripHiddenGroups", () => {
  const frame = { width: 400, height: 300 };
  // A revealed group holding a revealed card, and a hidden group holding one.
  const cards = [
    card("openGroup", true, { frame }),
    card("inOpen", true, { groupId: "openGroup" }),
    card("secretGroup", false, { frame }),
    card("inSecret", true, { groupId: "secretGroup" }),
  ];

  it("leaves the GM's membership alone", () => {
    expect(stripHiddenGroups(cards, "gm")).toEqual(cards);
  });

  it("keeps membership of a group the player can see", () => {
    const seen = stripHiddenGroups(visibleCards(cards, "player"), "player");
    expect(seen.find((c) => c.id === "inOpen")?.groupId).toBe("openGroup");
  });

  it("never tells a player about a group whose card is hidden", () => {
    const seen = stripHiddenGroups(visibleCards(cards, "player"), "player");
    // The hidden group's own card is gone, and the card inside it arrives loose.
    expect(seen.map((c) => c.id).sort()).toEqual(["inOpen", "inSecret", "openGroup"]);
    expect(seen.find((c) => c.id === "inSecret")?.groupId).toBeNull();
    expect(JSON.stringify(seen)).not.toContain("secretGroup");
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
