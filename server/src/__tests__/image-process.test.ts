import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepareImage, UnsupportedImageError } from "../images/process.js";

describe("prepareImage", () => {
  it("accepts a real PNG and normalises the format", async () => {
    const png = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 200, g: 10, b: 10 },
      },
    })
      .png()
      .toBuffer();

    const prepared = await prepareImage(png);
    expect(prepared.mime).toBe("image/png");
    expect(prepared.ext).toBe("png");
  });

  it("rejects a non-image buffer", async () => {
    await expect(
      prepareImage(Buffer.from("this is definitely not an image")),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it("caps oversized images to 2000px", async () => {
    const huge = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const prepared = await prepareImage(huge);
    const meta = await prepared.pipeline.toBuffer({ resolveWithObject: true });
    expect(Math.max(meta.info.width, meta.info.height)).toBeLessThanOrEqual(2000);
  });
});
