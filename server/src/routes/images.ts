import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { ImageMeta } from "@board/shared";
import { getMembership, requireBoardGM, requireBoardMember } from "../access.js";
import { requireAuth } from "../auth/session.js";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import { prepareImage, UnsupportedImageError } from "../images/process.js";
import type { AppEnv } from "../types.js";

// ─── Upload: POST /api/boards/:boardId/images (GM only) ──────────
export const imageUploadRoutes = new Hono<AppEnv>();
imageUploadRoutes.use("*", requireAuth, requireBoardMember, requireBoardGM);

imageUploadRoutes.post("/", async (c) => {
  const boardId = c.get("boardId");
  const user = c.get("user");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    return c.json({ error: "No file uploaded" }, 400);
  }
  if (file.size > config.maxUploadBytes) {
    return c.json(
      { error: `File too large (max ${config.maxUploadBytes} bytes)` },
      413,
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  // Validate it's a real raster image and normalise it. Re-encoding strips
  // any embedded metadata/scripts and guarantees the stored bytes are an image.
  let prepared;
  try {
    prepared = await prepareImage(input);
  } catch (e) {
    if (e instanceof UnsupportedImageError) return c.json({ error: e.message }, 415);
    throw e;
  }

  const id = nanoid();
  const filename = `${id}.${prepared.ext}`;
  const dest = path.join(config.uploadDir, filename);

  const info = await prepared.pipeline.toFile(dest);

  db.insert(schema.images)
    .values({
      id,
      boardId,
      filename,
      mime: prepared.mime,
      width: info.width,
      height: info.height,
      uploadedBy: user.id,
    })
    .run();

  const meta: ImageMeta = {
    id,
    boardId,
    width: info.width,
    height: info.height,
    mime: prepared.mime,
  };
  return c.json(meta, 201);
});

// ─── Serve: GET /api/images/:id (members only) ───────────────────
export const imageServeRoutes = new Hono<AppEnv>();
imageServeRoutes.use("*", requireAuth);

imageServeRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const image = db
    .select()
    .from(schema.images)
    .where(eq(schema.images.id, id))
    .get();
  if (!image) return c.json({ error: "Not found" }, 404);

  const role = getMembership(image.boardId, user.id);
  if (!role) return c.json({ error: "Forbidden" }, 403);

  // Players may only fetch art that is actually attached to a revealed card —
  // this stops enumeration of pre-staged, still-hidden images.
  if (role === "player") {
    const revealed = db
      .select({ id: schema.cards.id })
      .from(schema.cards)
      .where(
        and(
          eq(schema.cards.imageId, id),
          eq(schema.cards.boardId, image.boardId),
          eq(schema.cards.revealed, true),
        ),
      )
      .get();
    if (!revealed) return c.json({ error: "Forbidden" }, 403);
  }

  const filePath = path.join(config.uploadDir, image.filename);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) return c.json({ error: "Not found" }, 404);

  c.header("Content-Type", image.mime);
  c.header("Content-Length", String(fileStat.size));
  c.header("Cache-Control", "private, max-age=86400");
  // Node stream → web ReadableStream for Hono's body.
  const nodeStream = createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) =>
        controller.enqueue(
          chunk instanceof Buffer ? new Uint8Array(chunk) : chunk,
        ),
      );
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
  return c.body(webStream);
});
