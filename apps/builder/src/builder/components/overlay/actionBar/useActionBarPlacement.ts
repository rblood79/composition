/**
 * ADR-192 Phase 3 — 바 배치 훅: 드래그 이동 · Pin · Reset · clamp · 영속.
 *
 * - 저장 상태는 `canvasSettings.actionBar` (write-through localStorage).
 * - 드래그 중 위치는 로컬 state — 드롭 시 1회 commit (store 쓰기 1회).
 * - 마운트/리사이즈 시 저장 offset 을 overlay 안으로 clamp (R4).
 * - 부모(`.workspace-overlay`, inset:0) 가 배치 기준면.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useStore } from "../../../stores";
import type { ActionBarOffset } from "../../../stores/utils/actionBarStorage";
import {
  actionBarTransform,
  clampActionBarOffset,
  offsetsEqual,
  type Size,
} from "./actionBarPlacement";

function rectSize(element: Element | null | undefined): Size | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function useActionBarPlacement(barRef: RefObject<HTMLElement | null>) {
  const settings = useStore((state) => state.actionBar);
  const setActionBarOffset = useStore((state) => state.setActionBarOffset);
  const setActionBarPinned = useStore((state) => state.setActionBarPinned);
  const setActionBarHidden = useStore((state) => state.setActionBarHidden);

  const [dragOffset, setDragOffset] = useState<ActionBarOffset | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    base: ActionBarOffset;
  } | null>(null);

  const measure = useCallback((): { overlay: Size; bar: Size } | null => {
    const bar = barRef.current;
    const overlay = rectSize(bar?.parentElement);
    const barSize = rectSize(bar);
    if (!overlay || !barSize) return null;
    return { overlay, bar: barSize };
  }, [barRef]);

  // 저장된 offset 이 현재 overlay 밖이면 안으로 (마운트 + 리사이즈)
  useEffect(() => {
    const clampNow = () => {
      const offset = settings.offset;
      if (!offset) return;
      const sizes = measure();
      if (!sizes) return;
      const clamped = clampActionBarOffset(offset, sizes.overlay, sizes.bar);
      if (!offsetsEqual(clamped, offset)) setActionBarOffset(clamped);
    };
    clampNow();
    window.addEventListener("resize", clampNow);
    return () => window.removeEventListener("resize", clampNow);
  }, [measure, setActionBarOffset, settings.offset]);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (settings.pinned || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        base: settings.offset ?? { dx: 0, dy: 0 },
      };
    },
    [settings.offset, settings.pinned],
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const sizes = measure();
      const next = {
        dx: drag.base.dx + (event.clientX - drag.startX),
        dy: drag.base.dy + (event.clientY - drag.startY),
      };
      setDragOffset(
        sizes ? clampActionBarOffset(next, sizes.overlay, sizes.bar) : next,
      );
    },
    [measure],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragOffset((current) => {
        if (current && !offsetsEqual(current, settings.offset)) {
          setActionBarOffset(current);
        }
        return null;
      });
    },
    [setActionBarOffset, settings.offset],
  );

  return {
    hidden: settings.hidden,
    pinned: settings.pinned,
    dragging: dragOffset !== null,
    transform: actionBarTransform(dragOffset ?? settings.offset),
    handleProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    togglePinned: () => setActionBarPinned(!settings.pinned),
    resetPosition: () => setActionBarOffset(null),
    hide: () => setActionBarHidden(true),
  };
}
