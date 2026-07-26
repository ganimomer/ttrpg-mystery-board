import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "../auth/token.js";

describe("session token", () => {
  it("round-trips a user id", () => {
    const token = signSession("user-123");
    expect(verifySession(token)).toBe("user-123");
  });

  it("rejects a tampered signature", () => {
    const token = signSession("user-123");
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");
    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects a tampered payload (user id swap)", () => {
    const token = signSession("user-123");
    const forged = token.replace("user-123", "user-999");
    expect(verifySession(forged)).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = signSession("user-123", -1000); // already in the past
    expect(verifySession(expired)).toBeNull();
  });

  it("rejects malformed / empty input", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession(null)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("not-a-token")).toBeNull();
    expect(verifySession("a.b.c.d")).toBeNull();
  });
});
