import { useRef, useState } from "react";
import type { Card } from "@board/shared";
import { FRAME_MIN, frameRect } from "./layout";

interface Props {
  card: CardWithFrame;
  editable: boolean;
  /** A card is being dragged into this frame right now. */
  targeted: boolean;
  zoom: number;
  onResize: (width: number, height: number, commit: boolean) => void;
}

/** A group card, narrowed: `frame` is what makes it one. */
type CardWithFrame = Card & { frame: NonNullable<Card["frame"]> };

/**
 * The dotted rectangle drawn around a group's cards, hanging below its
 * nameplate. Rendered behind every card and it never swallows a pointer — the
 * cork underneath must stay draggable — except at the resize grip in its corner.
 */
export function GroupFrame({ card, editable, targeted, zoom, onResize }: Props) {
  const rect = frameRect(card)!;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const [resizing, setResizing] = useState(false);

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      width: card.frame.width,
      height: card.frame.height,
    };
    setResizing(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // The frame grows about the nameplate, so it widens at twice the pointer's
    // horizontal travel — one edge each side.
    const dx = ((e.clientX - d.startX) / zoom) * 2;
    const dy = (e.clientY - d.startY) / zoom;
    onResize(
      Math.max(FRAME_MIN.width, Math.round(d.width + dx)),
      Math.max(FRAME_MIN.height, Math.round(d.height + dy)),
      false,
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setResizing(false);
    onResize(card.frame.width, card.frame.height, true);
  }

  return (
    <div
      className={[
        "group-frame",
        targeted ? "is-target" : "",
        resizing ? "is-resizing" : "",
        card.revealed ? "" : "is-hidden",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      {editable && (
        <button
          type="button"
          className="frame-resize"
          aria-label={`Resize ${card.title || "group"}`}
          title="Drag to resize the group"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

/** Narrows a card list to the groups in it. */
export function groupCards(cards: Card[]): CardWithFrame[] {
  return cards.filter((c): c is CardWithFrame => c.frame !== null);
}
