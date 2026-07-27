import { describe, expect, it } from "vitest";
import type { Card, Tidbit } from "@board/shared";
import {
  reorderOnReveal,
  shapeCardForRole,
  visibleTidbits,
} from "../reveal.js";

const t = (id: string, revealed: boolean): Tidbit => ({
  id,
  text: `text-${id}`,
  revealed,
});

describe("visibleTidbits", () => {
  const items = [t("a", true), t("b", false), t("c", true)];
  it("gives the GM all tidbits", () => {
    expect(visibleTidbits(items, "gm")).toHaveLength(3);
  });
  it("gives players only revealed tidbits", () => {
    expect(visibleTidbits(items, "player").map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("shapeCardForRole", () => {
  const card: Card = {
    id: "card1",
    boardId: "b",
    title: "NPC",
    note: "",
    imageUrl: null,
    groupId: null,
    frame: null,
    x: 0,
    y: 0,
    rotation: 0,
    revealed: true,
    notepad: [t("a", true), t("secret", false)],
  };

  it("keeps everything for the GM", () => {
    expect(shapeCardForRole(card, "gm").notepad).toHaveLength(2);
  });

  it("strips un-revealed tidbit text for players", () => {
    const shaped = shapeCardForRole(card, "player");
    expect(shaped.notepad.map((x) => x.id)).toEqual(["a"]);
    expect(JSON.stringify(shaped)).not.toContain("text-secret");
  });
});

describe("reorderOnReveal", () => {
  const ids = (items: { id: string }[]) => items.map((i) => i.id);

  it("moves a newly revealed item to the bottom of the revealed block", () => {
    const start = [
      t("a", false),
      t("b", false),
      t("c", false),
      t("d", false),
    ];
    const afterC = reorderOnReveal(start, "c", true);
    expect(ids(afterC)).toEqual(["c", "a", "b", "d"]);
    expect(afterC[0].revealed).toBe(true);

    // Revealing another lands right after the first revealed, preserving order.
    const afterA = reorderOnReveal(afterC, "a", true);
    expect(ids(afterA)).toEqual(["c", "a", "b", "d"]);
    expect(afterA.slice(0, 2).every((x) => x.revealed)).toBe(true);
  });

  it("drops a hidden item to the first un-revealed slot", () => {
    const items = [t("c", true), t("a", true), t("b", false), t("d", false)];
    const afterHide = reorderOnReveal(items, "c", false);
    // c leaves the revealed block and sits just below the remaining revealed (a).
    expect(ids(afterHide)).toEqual(["a", "c", "b", "d"]);
    expect(afterHide[0].id).toBe("a");
    expect(afterHide[1]).toMatchObject({ id: "c", revealed: false });
  });

  it("is a no-op for an unknown id", () => {
    const items = [t("a", true)];
    expect(reorderOnReveal(items, "nope", false)).toBe(items);
  });
});
