import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { BoardEvent } from "@board/shared";
import { requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { subscribe } from "../realtime/subscribers.js";
import type { AppEnv } from "../types.js";

export const eventsRoutes = new Hono<AppEnv>();
eventsRoutes.use("*", requireAuth, requireBoardMember);

// Live board stream. Players receive a reveal-filtered feed (enforced by the
// bus): hidden items arrive as `*.removed`, never as data.
eventsRoutes.get("/", (c) => {
  const boardId = c.get("boardId");
  const role = c.get("role");

  return streamSSE(c, async (stream) => {
    const queue: BoardEvent[] = [];
    let notify: (() => void) | null = null;

    const unsubscribe = subscribe(boardId, {
      role,
      send: (event) => {
        queue.push(event);
        notify?.();
      },
    });

    stream.onAbort(() => {
      unsubscribe();
      notify?.();
    });

    await stream.writeSSE({ event: "ready", data: "1" });

    try {
      while (!stream.aborted) {
        while (queue.length > 0) {
          const event = queue.shift()!;
          await stream.writeSSE({
            event: "board",
            data: JSON.stringify(event),
          });
        }
        if (stream.aborted) break;
        // Wait for the next event or a ~25s heartbeat, whichever comes first.
        await new Promise<void>((resolve) => {
          notify = resolve;
          const timer = setTimeout(resolve, 25_000);
          // Ensure the timer doesn't keep the resolve pinned after firing.
          void timer;
        });
        notify = null;
        if (queue.length === 0 && !stream.aborted) {
          await stream.writeSSE({ event: "ping", data: "1" });
        }
      }
    } finally {
      unsubscribe();
    }
  });
});
