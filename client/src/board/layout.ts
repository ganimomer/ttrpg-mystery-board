// Board-space dimensions shared by cards and the string layer.
export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 280;

// The tack sits near the top-center; strings anchor to it.
export function tackAnchor(x: number, y: number): { x: number; y: number } {
  return { x: x + CARD_WIDTH / 2, y: y + 14 };
}
