// Torn-edge geometry for note cards: a rectangle ripped along its bottom edge.
// Pure and deterministic — the same card id always yields the same tear, so a
// card's silhouette never changes as it re-renders, drags or re-reveals.

/** Cheap string hash → 32-bit seed. */
function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG. Returns values in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POINTS = 15; // sample columns across the bottom edge
const FIBER_RATIO = 0.5; // fiber cuts are shallower, so its edge sits lower

export interface TearPaths {
  /** clip-path for the paper face. */
  face: string;
  /** clip-path for the pale fiber layer peeking through the notches. */
  fiber: string;
}

/**
 * Two `polygon(...)` clip-paths for one card. Both walk the top edge left→right
 * then the bottom edge right→left; bottom points are `calc(100% - Npx)` so the
 * tear keeps its physical depth however tall the sheet grows.
 *
 * Invariant: at every sample column the fiber boundary sits *below* the face's
 * (a shallower cut = lower edge). That is what lets the pale rim show through
 * the bites instead of being hidden behind the face.
 *
 * `fold` (px) cuts the top-right corner off at 45°, for a dog-eared sheet. It
 * adds one point to the top edge of both polygons, so every fold size yields
 * the same point count and CSS can animate between two of them.
 */
export function tearPaths(id: string, fold = 0): TearPaths {
  const rand = mulberry32(hashSeed(id));

  const top =
    fold > 0
      ? ["0% 0%", `calc(100% - ${fold}px) 0%`, `100% ${fold}px`]
      : ["0% 0%", "100% 0%"];
  const face: string[] = [...top];
  const fiber: string[] = [...top];

  for (let i = POINTS - 1; i >= 0; i--) {
    // Jitter x off the even grid so the rip doesn't read as a regular zigzag.
    const spread = 100 / (POINTS - 1);
    const jitter = i === 0 || i === POINTS - 1 ? 0 : (rand() - 0.5) * spread * 0.6;
    const x = Math.min(100, Math.max(0, i * spread + jitter));

    // Mostly shallow nicks, with the occasional deeper bite into the paper.
    const depth = rand() < 0.22 ? 7 + rand() * 8 : 1 + rand() * 5;

    face.push(`${x.toFixed(2)}% calc(100% - ${depth.toFixed(1)}px)`);
    fiber.push(`${x.toFixed(2)}% calc(100% - ${(depth * FIBER_RATIO).toFixed(1)}px)`);
  }

  return {
    face: `polygon(${face.join(", ")})`,
    fiber: `polygon(${fiber.join(", ")})`,
  };
}
