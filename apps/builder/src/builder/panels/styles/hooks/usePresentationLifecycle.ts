import { useEffect, type RefObject } from "react";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import type { EditorPresentationHandle } from "../../../presentation/editorPresentationTypes";

interface PresentationLifecycleState {
  readonly handle: EditorPresentationHandle;
  readonly selectedElementId: string;
  phase: "active" | "cancelled" | "failed";
}

/** 편집 소유자의 선택 변경·포커스 이탈·해제 시 취소와 구독 해제를 공유한다. */
export function usePresentationLifecycle<T extends PresentationLifecycleState>(
  stateRef: RefObject<T | null>,
): void {
  useEffect(() => {
    const unsubscribeSelection = useStore.subscribe(() => {
      const active = stateRef.current;
      if (!active) return;
      const { selectedElementId } = readImmediateSelectionSnapshot();
      if (selectedElementId !== active.selectedElementId) {
        active.handle.cancel("selection-change");
        active.phase = "cancelled";
      }
    });
    const handleWindowBlur = (): void => {
      const active = stateRef.current;
      if (active?.phase === "active") {
        active.handle.cancel("blur");
        active.phase = "cancelled";
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      stateRef.current?.handle.cancel("unmount");
      stateRef.current = null;
      unsubscribeSelection();
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [stateRef]);
}
