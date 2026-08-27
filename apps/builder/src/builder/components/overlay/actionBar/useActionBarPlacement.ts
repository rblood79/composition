/**
 * ADR-192 Phase 3 — 바 배치 훅: 드래그 이동 · Pin · Reset · clamp · 영속.
 *
 * - 저장 상태는 `canvasSettings.actionBar` (write-through localStorage).
 * - 드래그 중 위치는 로컬 state — 드롭 시 1회 commit (store 쓰기 1회).
 * - 저장 offset 은 **바가 실제로 나타난 시점부터** overlay 안으로 clamp (R4).
 *   바가 없는 동안(선택 0 / 텍스트 편집 / Hide)에는 잴 것이 없다.
 * - 부모(`.workspace-overlay`, inset:0) 가 배치 기준면.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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

export function useActionBarPlacement() {
  const settings = useStore((state) => state.actionBar);
  const setActionBarOffset = useStore((state) => state.setActionBarOffset);
  const setActionBarPinned = useStore((state) => state.setActionBarPinned);
  const setActionBarHidden = useStore((state) => state.setActionBarHidden);

  // 바 DOM 은 마운트/언마운트를 반복한다 (선택 0 / 편집 중 / Hide → null).
  // `useRef` 로 잡으면 "언제 생겼는지" 를 effect 가 알 수 없어 clamp 가 영영
  // 실행되지 않는다 — 노드를 state 로 들어 effect 의 의존으로 쓴다.
  const [barElement, setBarElement] = useState<HTMLElement | null>(null);

  const [dragOffset, setDragOffset] = useState<ActionBarOffset | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    base: ActionBarOffset;
  } | null>(null);
  // 드롭 시 commit 할 값. `setDragOffset` updater 안에서 store 를 쓰면 그
  // updater 가 render phase 에 실행될 때 다른 컴포넌트 갱신이 되어 React DEV
  // 경고가 난다 (code-review #11) — 값은 여기 두고 commit 은 이벤트 핸들러
  // 본문에서 한다.
  const pendingOffsetRef = useRef<ActionBarOffset | null>(null);

  const measure = useCallback((): { overlay: Size; bar: Size } | null => {
    const overlay = rectSize(barElement?.parentElement);
    const barSize = rectSize(barElement);
    if (!overlay || !barSize) return null;
    return { overlay, bar: barSize };
  }, [barElement]);

  // 저장된 offset 이 현재 overlay 밖이면 안으로.
  //
  // 재실행 계기는 3가지 — (a) 바가 나타남(barElement), (b) 바 크기 변화(컨텍스트
  // 전환으로 항목 수가 바뀜), (c) overlay 크기 변화(창 리사이즈 · 패널 도크
  // 리사이즈). ResizeObserver 는 관찰 시작 시점에도 1회 발화하므로 (a) 를 겸한다.
  // window resize 리스너로는 (b) 와 "창 크기는 그대로인데 패널이 접혀 overlay 가
  // 넓어진" 경우를 못 잡는다.
  useEffect(() => {
    if (!barElement) return;
    const overlay = barElement.parentElement;

    const clampNow = () => {
      const offset = settings.offset;
      if (!offset) return;
      const sizes = measure();
      if (!sizes) return;
      const clamped = clampActionBarOffset(offset, sizes.overlay, sizes.bar);
      if (!offsetsEqual(clamped, offset)) setActionBarOffset(clamped);
    };

    // 바가 나타난 그 시점 1회 — ResizeObserver 의 최초 전달에 맡기지 않는다.
    // RO 콜백은 렌더링 단계에 실려 오므로 탭이 보이지 않는 동안에는 지연된다
    // (실측: hidden 탭에서 rAF·RO 모두 정지). 이 clamp 는 "바가 화면 밖에
    // 고착됐는가" 를 막는 경로라 마운트 시점에 결정적으로 돌아야 한다.
    clampNow();

    const observer = new ResizeObserver(clampNow);
    observer.observe(barElement);
    if (overlay) observer.observe(overlay);
    return () => observer.disconnect();
  }, [barElement, measure, setActionBarOffset, settings.offset]);

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
      pendingOffsetRef.current = null;
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
      const clamped = sizes
        ? clampActionBarOffset(next, sizes.overlay, sizes.bar)
        : next;
      pendingOffsetRef.current = clamped;
      setDragOffset(clamped);
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
      const committed = pendingOffsetRef.current;
      pendingOffsetRef.current = null;
      setDragOffset(null);
      if (committed && !offsetsEqual(committed, settings.offset)) {
        setActionBarOffset(committed);
      }
    },
    [setActionBarOffset, settings.offset],
  );

  return {
    hidden: settings.hidden,
    pinned: settings.pinned,
    dragging: dragOffset !== null,
    transform: actionBarTransform(dragOffset ?? settings.offset),
    /** 바 루트에 그대로 붙인다 — 노드가 생기고 사라지는 시점을 훅이 알아야 한다 */
    barRef: setBarElement as (node: HTMLDivElement | null) => void,
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
