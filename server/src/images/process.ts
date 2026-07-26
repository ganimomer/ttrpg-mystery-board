import sharp from "sharp";

const MAX_DIMENSION = 2000;

// Accepted input formats → normalised output. Re-encoding strips EXIF/metadata
// and guarantees the stored bytes are a real raster image.
const OUTPUT: Record<string, { mime: string; ext: string }> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
};

export class UnsupportedImageError extends Error {}

export interface PreparedImage {
  pipeline: sharp.Sharp;
  mime: string;
  ext: string;
}

/**
 * Validates that `input` is a supported raster image and returns a sharp
 * pipeline that strips metadata and caps dimensions. Throws
 * UnsupportedImageError for anything that isn't a JPEG/PNG/WebP image.
 */
export async function prepareImage(input: Buffer): Promise<PreparedImage> {
  let format: string;
  let img: sharp.Sharp;
  try {
    img = sharp(input, { failOn: "error" });
    const meta = await img.metadata();
    format = meta.format ?? "";
  } catch {
    throw new UnsupportedImageError("That file is not a valid image");
  }
  const out = OUTPUT[format];
  if (!out) {
    throw new UnsupportedImageError(
      "Unsupported image type (use JPEG, PNG or WebP)",
    );
  }
  return {
    pipeline: img.rotate().resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    }),
    mime: out.mime,
    ext: out.ext,
  };
}
