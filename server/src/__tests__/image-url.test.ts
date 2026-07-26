import { describe, expect, it } from "vitest";
import { isSafeImageUrl } from "../routes/cards.js";

describe("isSafeImageUrl", () => {
  it("accepts https URLs", () => {
    expect(isSafeImageUrl("https://cdn.discordapp.com/attachments/foo.png")).toBe(true);
  });

  it("accepts http URLs", () => {
    expect(isSafeImageUrl("http://example.com/photo.jpg")).toBe(true);
  });

  it("rejects data: URIs", () => {
    expect(isSafeImageUrl("data:image/png;base64,abc")).toBe(false);
  });

  it("rejects javascript: URIs", () => {
    expect(isSafeImageUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isSafeImageUrl("")).toBe(false);
  });

  it("rejects URLs exceeding 2048 characters", () => {
    const long = "https://example.com/" + "a".repeat(2040);
    expect(isSafeImageUrl(long)).toBe(false);
  });

  it("accepts URLs at exactly 2048 characters", () => {
    const url = "https://x.co/" + "a".repeat(2048 - "https://x.co/".length);
    expect(url.length).toBe(2048);
    expect(isSafeImageUrl(url)).toBe(true);
  });
});
