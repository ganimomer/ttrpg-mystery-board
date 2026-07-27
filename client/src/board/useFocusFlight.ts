import { useLayoutEffect, useRef, useState } from "react";
import { CARD_WIDTH } from "./layout";

/** Where a focused card takes off from: its board self, in screen coordinates. */
export interface FocusFrom {
  /** Centre of the board card's box — exact even when the card is tilted, since
   *  a rotation about the default origin leaves the centre where it was. */
  cx: number;
  cy: number;
  /** The viewport zoom the board card was drawn at. */
  scale: number;
}

const FLIGHT_MS = 240;
const EASE = "cubic-bezier(0.2, 0.8, 0.25, 1)";

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Flies the focused card out of the board and back again — FLIP, no library.
 *
 * The transform is applied to the whole shell (card, notepad, bin) but measured
 * from the *card* inside it, with `transform-origin` moved onto the card's
 * centre. So the card lands exactly on its board self while everything below
 * unfolds out of it. The card wears its own tilt, so the flight is pure zoom.
 *
 * It animates through the Web Animations API rather than a CSS transition:
 * setting a transform and clearing it again on the next frame is at the mercy
 * of style-recalc coalescing, and when the two changes land together no
 * transition runs at all. `animate()` states both ends up front instead.
 */
export function useFocusFlight(from: FocusFrom | null, onClose: () => void) {
  const shellRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"flying" | "open" | "leaving">(
    reducedMotion() ? "open" : "flying",
  );
  const flight = useRef<Animation | null>(null);

  /**
   * How the shell has to be transformed to sit on top of the board card, as the
   * *first* keyframe. The explicit `offset: 0` is load-bearing: a lone keyframe
   * is the animation's end, not its start, so without it the card flies from
   * the middle of the stage back down onto the board.
   */
  function onTheBoard(shell: HTMLElement): Keyframe {
    const card = cardRef.current;
    // Nothing to fly from — a card created off-screen. It pops in instead.
    if (!card || !from) return { offset: 0, transform: "scale(0.94)", opacity: 0 };
    // Measured off the layout box, not `getBoundingClientRect`: the shell is
    // rotated by the card's own tilt, and a rotated element's client rect is
    // its inflated bounding box. `offset*` is in the shell's own untransformed
    // space, which is what `transform-origin` and the scale both need.
    const ox = card.offsetLeft + card.offsetWidth / 2;
    const oy = card.offsetTop + card.offsetHeight / 2;
    const scale = (CARD_WIDTH * from.scale) / card.offsetWidth;
    shell.style.transformOrigin = `${ox}px ${oy}px`;
    // The centre of a rotated box's bounding box is still the box's centre, so
    // this much can be read off the screen.
    const cr = card.getBoundingClientRect();
    const screenX = cr.left + cr.width / 2;
    const screenY = cr.top + cr.height / 2;
    // No rotation here: the card already wears its own tilt, so coming closer
    // is a pure zoom.
    return {
      offset: 0,
      transform:
        `translate(${from.cx - screenX}px, ${from.cy - screenY}px) scale(${scale})`,
    };
  }

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell || phase === "open") return;
    // One keyframe: the other end is the card's resting style.
    const a = shell.animate([onTheBoard(shell)], { duration: FLIGHT_MS, easing: EASE });
    flight.current = a;
    a.finished.then(() => setPhase("open"), () => {}); // cancelling rejects
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    if (phase === "leaving") return;
    const shell = shellRef.current;
    if (!shell || reducedMotion()) {
      onClose();
      return;
    }
    // Land back on the board card measured from rest, so an Escape mid-flight
    // still aims at the right place.
    flight.current?.cancel();
    setPhase("leaving");
    const a = shell.animate([onTheBoard(shell)], {
      duration: FLIGHT_MS,
      easing: EASE,
      direction: "reverse",
      fill: "forwards",
    });
    flight.current = a;
    // Unmounting is what commits a field still being typed in, so it waits for
    // the card to be back on the board.
    a.finished.then(onClose, () => {});
  }

  return { shellRef, cardRef, open: phase === "open", requestClose };
}
