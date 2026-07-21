import { useCallback, useRef, useState } from "react";

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function useViewport(initial?: Partial<Viewport>) {
  const [vp, setVp] = useState<Viewport>({
    panX: initial?.panX ?? 0,
    panY: initial?.panY ?? 0,
    zoom: initial?.zoom ?? 1,
  });
  const pan = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onWheel = useCallback((e: React.WheelEvent) => {
    // Zoom toward the cursor.
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setVp((prev) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const k = zoom / prev.zoom;
      // Keep the board point under the cursor stationary.
      return {
        zoom,
        panX: cx - (cx - prev.panX) * k,
        panY: cy - (cy - prev.panY) * k,
      };
    });
  }, []);

  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setVp((prev) => {
      pan.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: prev.panX,
        originY: prev.panY,
      };
      return prev;
    });
  }, []);

  const onBackgroundPointerMove = useCallback((e: React.PointerEvent) => {
    const p = pan.current;
    if (!p || p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    setVp((prev) => ({ ...prev, panX: p.originX + dx, panY: p.originY + dy }));
  }, []);

  const onBackgroundPointerUp = useCallback((e: React.PointerEvent) => {
    if (pan.current?.pointerId === e.pointerId) pan.current = null;
  }, []);

  const screenToBoard = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => ({
      x: (clientX - rect.left - vp.panX) / vp.zoom,
      y: (clientY - rect.top - vp.panY) / vp.zoom,
    }),
    [vp],
  );

  const isPanning = useCallback(() => pan.current !== null, []);

  return {
    vp,
    onWheel,
    onBackgroundPointerDown,
    onBackgroundPointerMove,
    onBackgroundPointerUp,
    screenToBoard,
    isPanning,
  };
}
