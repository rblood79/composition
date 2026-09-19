/**
 * window 기반 pointer 드래그 lifecycle — ADR-222 spacing · ADR-224 resize 훅이 같은 골격을 읽는다.
 *
 * 한 pointer 가 소유한 드래그의 move/up/cancel/blur/unmount/Escape 종료 규약을 한 곳에 둔다:
 * - move: 같은 pointerId 만 · runtime 세션이 먼저 닫혔으면 (`phase !== "active"`) 취소 ·
 *   임계값 (`POINTER_DRAG_THRESHOLD_PX`) 을 넘는 순간 `dragging = true` + `onDragStart` ·
 *   이후 `onMove(drag, dxClient, dyClient)`
 * - up → finish · pointercancel → cancel("pointer-cancel") · blur → cancel("blur") ·
 *   unmount → cancel("unmount") · Escape (드래그 중일 때만, capture + stopPropagation — 전역
 *   Escape 선택 해제가 같은 keydown 에 돌지 않게) → cancel("escape")
 *
 * 세션 종류별 마무리 (finish/cancel 이 무엇을 하는지, 클릭 → 인라인 입력 등) 는 호출 훅의
 * `endDrag` 가 소유한다.
 */
import { useEffect, type MutableRefObject } from "react";
import type { EditorPresentationCancelReason } from "../../../presentation/editorPresentationTypes";

/** 클릭 ↔ 드래그 갈림 (screen px) — element drag 의 DRAG_THRESHOLD 와 같은 값 */
export const POINTER_DRAG_THRESHOLD_PX = 3;

/** `EditorPresentationCancelReason` 중 pointer lifecycle 이 내는 것 */
export type PointerDragCancelReason = Extract<
  EditorPresentationCancelReason,
  "escape" | "pointer-cancel" | "blur" | "unmount" | "selection-change"
>;

export interface PointerDragState {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly session: { readonly phase: string };
  dragging: boolean;
}

export interface UsePointerDragLifecycleOptions<T extends PointerDragState> {
  dragRef: MutableRefObject<T | null>;
  endDrag: (
    outcome: "finish" | "cancel",
    reason?: PointerDragCancelReason,
  ) => void;
  /** 임계값을 넘은 첫 move — 시각 상태 전환 (spacing 은 press → drag) */
  onDragStart?: (drag: T) => void;
  /** dragging 중 move 마다 — client px delta (zoom 환산은 호출 훅) */
  onMove: (drag: T, dxClient: number, dyClient: number) => void;
}

export function usePointerDragLifecycle<T extends PointerDragState>({
  dragRef,
  endDrag,
  onDragStart,
  onMove,
}: UsePointerDragLifecycleOptions<T>): void {
  useEffect(() => {
    const handleMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.session.phase !== "active") {
        // 문서 교체·conflict 로 runtime 이 먼저 닫았다 — 드래그도 정리
        endDrag("cancel");
        return;
      }
      const dxClient = event.clientX - drag.startClientX;
      const dyClient = event.clientY - drag.startClientY;
      if (
        !drag.dragging &&
        Math.hypot(dxClient, dyClient) >= POINTER_DRAG_THRESHOLD_PX
      ) {
        drag.dragging = true;
        onDragStart?.(drag);
      }
      if (!drag.dragging) return;
      onMove(drag, dxClient, dyClient);
    };
    const handleUp = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag("finish");
    };
    const handleCancel = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag("cancel", "pointer-cancel");
    };
    const handleBlur = (): void => {
      if (dragRef.current) endDrag("cancel", "blur");
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("blur", handleBlur);
      if (dragRef.current) endDrag("cancel", "unmount");
    };
  }, [dragRef, endDrag, onDragStart, onMove]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || !dragRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      endDrag("cancel", "escape");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dragRef, endDrag]);
}
