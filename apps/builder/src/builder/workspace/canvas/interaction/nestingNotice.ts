/**
 * 중첩 preflight 결과를 사용자에게 알린다 (구 store 경로) — 토스트 자체는 `nestingToast.ts`,
 * 여기는 되돌리기를 구 store undo 로 잇는다.
 */
import { useStore } from "../../../stores";
import type { NestingRelocation } from "./nestingRelocation";
import { showNestingRelocatedToast } from "./nestingToast";

export { notifyNestingRejected } from "./nestingToast";

/**
 * 옮긴 뒤 부른다 — 이동이 실제로 일어난 다음이어야 되돌리기가 그 이동을 되돌린다.
 * `withUndo` 는 이 relocation 이 history entry **하나**에 대응할 때만 `true` 로 넘긴다
 * (여러 entry 를 남기는 경로에서 undo 1회는 마지막 하나만 되돌린다).
 */
export function notifyNestingRelocation(
  relocation: NestingRelocation,
  relocatedToLabel: string,
  options: { withUndo?: boolean } = {},
): void {
  showNestingRelocatedToast(
    relocation.violation,
    relocatedToLabel,
    options.withUndo === false
      ? undefined
      : () => {
          // 스토어 action 이어야 한다 — `historyManager.undo()` 는 엔트리를 꺼내
          // 포인터만 옮기고 문서·스토어에 역적용을 하지 않는다 (적용은
          // `historyActions.createUndoAction` 이 한다). 2026-09-08 사용자 재현:
          // "undo 를 클릭해도 추가된 요소가 다시 제거되지 않는다".
          void useStore.getState().undo();
        },
  );
}
