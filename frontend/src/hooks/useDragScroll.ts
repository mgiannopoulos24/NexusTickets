import { useMemo, useRef } from 'react';

type UseDragScrollOptions = {
  /**
   * Pixels of movement before we treat it as a drag.
   * This helps avoid cancelling normal clicks.
   */
  dragThresholdPx?: number;
};

type DragScrollHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
};

export function useDragScroll<T extends HTMLElement>(
  opts?: UseDragScrollOptions,
): {
  ref: React.RefObject<T | null>;
  handlers: DragScrollHandlers;
} {
  const ref = useRef<T | null>(null);
  const dragThresholdPx = opts?.dragThresholdPx ?? 6;

  const state = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startScrollLeft: number;
    hasDragged: boolean;
    captured: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    hasDragged: false,
    captured: false,
  });

  const handlers = useMemo<DragScrollHandlers>(
    () => ({
      onPointerDown: (e) => {
        // Only left button for mouse; allow touch/pen.
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const el = ref.current;
        if (!el) return;

        state.current.active = true;
        state.current.pointerId = e.pointerId;
        state.current.startX = e.clientX;
        state.current.startY = e.clientY;
        state.current.startScrollLeft = el.scrollLeft;
        state.current.hasDragged = false;
        state.current.captured = false;

        // Pointer capture is deliberately NOT taken here. While a container
        // holds the capture, the browser retargets the following `click` to
        // that container, so a click on a child button never reaches it. The
        // capture is taken in onPointerMove instead, once the movement is a
        // real drag.
      },
      onPointerMove: (e) => {
        const el = ref.current;
        if (!el) return;
        if (!state.current.active) return;
        if (state.current.pointerId !== e.pointerId) return;

        const dx = e.clientX - state.current.startX;
        const dy = e.clientY - state.current.startY;
        if (!state.current.hasDragged) {
          if (Math.hypot(dx, dy) >= dragThresholdPx) {
            state.current.hasDragged = true;
            try {
              el.setPointerCapture(e.pointerId);
              state.current.captured = true;
            } catch {
              // ignore
            }
            if (e.pointerType === 'mouse') {
              el.style.cursor = 'grabbing';
            }
          } else {
            return;
          }
        }

        // Prevent text selection / native drag.
        e.preventDefault();
        el.scrollLeft = state.current.startScrollLeft - dx;
      },
      onPointerUp: (e) => {
        const el = ref.current;
        if (!el) return;
        if (state.current.pointerId !== e.pointerId) return;

        state.current.active = false;
        state.current.pointerId = null;

        if (state.current.captured) {
          try {
            el.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          state.current.captured = false;
        }

        if (e.pointerType === 'mouse') {
          el.style.cursor = '';
        }
      },
      onPointerCancel: (e) => {
        const el = ref.current;
        if (!el) return;
        if (state.current.pointerId !== e.pointerId) return;

        state.current.active = false;
        state.current.pointerId = null;
        if (state.current.captured) {
          try {
            el.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          state.current.captured = false;
        }
        if (e.pointerType === 'mouse') {
          el.style.cursor = '';
        }
      },
      onClickCapture: (e) => {
        // If we dragged, cancel click (prevents accidental navigation).
        if (state.current.hasDragged) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    }),
    [dragThresholdPx],
  );

  return { ref, handlers };
}
