import { describe, expect, it } from "vitest";
import { findStringBetween, samePair } from "@board/shared";
import type { Connection } from "@board/shared";

function conn(id: string, from: string, to: string): Connection {
  return {
    id,
    boardId: "b",
    fromCardId: from,
    toCardId: to,
    label: "",
    color: "#000000",
    revealed: false,
  };
}

describe("samePair", () => {
  const ab = { fromCardId: "a", toCardId: "b" };

  it("matches the same pair tied the same way round", () => {
    expect(samePair(ab, { fromCardId: "a", toCardId: "b" })).toBe(true);
  });

  it("matches the same pair tied the other way round", () => {
    expect(samePair(ab, { fromCardId: "b", toCardId: "a" })).toBe(true);
  });

  it("does not match a pair sharing only one card", () => {
    expect(samePair(ab, { fromCardId: "a", toCardId: "c" })).toBe(false);
    expect(samePair(ab, { fromCardId: "c", toCardId: "b" })).toBe(false);
  });

  it("does not match a disjoint pair", () => {
    expect(samePair(ab, { fromCardId: "c", toCardId: "d" })).toBe(false);
  });
});

describe("findStringBetween", () => {
  const strings = [conn("1", "a", "b"), conn("2", "b", "c")];

  it("finds the string however it was tied", () => {
    expect(findStringBetween(strings, { fromCardId: "a", toCardId: "b" })?.id)
      .toBe("1");
    expect(findStringBetween(strings, { fromCardId: "b", toCardId: "a" })?.id)
      .toBe("1");
    expect(findStringBetween(strings, { fromCardId: "c", toCardId: "b" })?.id)
      .toBe("2");
  });

  it("returns undefined when the cards are not strung together", () => {
    expect(
      findStringBetween(strings, { fromCardId: "a", toCardId: "c" }),
    ).toBeUndefined();
  });

  it("returns undefined on a board with no strings", () => {
    expect(
      findStringBetween([], { fromCardId: "a", toCardId: "b" }),
    ).toBeUndefined();
  });
});
