/**
 * 중첩 relocation 토스트의 되돌리기 배선.
 *
 * Why: `historyManager.undo()` 는 엔트리를 꺼내 포인터만 옮긴다 — 문서·스토어 역적용은
 * `historyActions.createUndoAction` (스토어 action) 이 한다. 매니저를 직접 부르면
 * 버튼이 아무것도 되돌리지 않으면서 히스토리 포인터만 어긋난다 (2026-09-08 사용자 재현).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../../../../stores";
import { useToastStore } from "../../../../stores/toast";
import {
  notifyNestingRelocation,
  notifyNestingRejected,
} from "../nestingNotice";
import type { NestingRelocation } from "../nestingRelocation";

const relocation: NestingRelocation = {
  violation: {
    layer: "html-content",
    parentType: "Button",
    childType: "Button",
    reason: "test",
  },
  relocatedToId: "body",
  originalTargetId: "button-1",
};

describe("notifyNestingRelocation", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [], lastShownMap: new Map() });
  });

  it("되돌리기는 스토어 undo action 을 부른다 (매니저 직접 호출 금지)", () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const spy = vi
      .spyOn(useStore, "getState")
      .mockReturnValue({ undo } as unknown as ReturnType<
        typeof useStore.getState
      >);

    notifyNestingRelocation(relocation, "body");
    const action = useToastStore.getState().toasts[0]?.action;
    expect(action).toBeDefined();
    action!.onClick();
    expect(undo).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it("withUndo:false 면 버튼을 달지 않는다 (엔트리가 여러 개인 경로)", () => {
    notifyNestingRelocation(relocation, "body", { withUndo: false });
    expect(useToastStore.getState().toasts[0]?.action).toBeUndefined();
  });

  it("거부 안내에는 되돌릴 것이 없다", () => {
    notifyNestingRejected(relocation.violation);
    const toast = useToastStore.getState().toasts[0];
    expect(toast?.action).toBeUndefined();
    expect(toast?.type).toBe("error");
  });
});
