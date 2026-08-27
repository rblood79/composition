// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../../stores";
import { useCanvasStore } from "../../stores/canvasStore";
import { useTextEdit } from "./useTextEdit";

/**
 * 2026-08-27 code-review #6 — `isEditing` 은 `useCanvasStore` 싱글턴이고
 * 내려가는 경로가 completeEdit/cancelEdit 뿐이었다. 마우스 클릭은
 * TextEditOverlay 의 document mousedown 이 먼저 완료를 부르지만, 비-마우스
 * 경로(브라우저 Back, compare 모드 토글)로 BuilderCanvas 가 사라지면 true 가
 * 남아 ADR-192 액션 바가 다시는 마운트되지 않는다.
 */
const TEXT_ELEMENT = {
  id: "text-1",
  type: "Text",
  props: { children: "hello" },
  parent_id: null,
  page_id: "page-1",
} as const;

afterEach(() => {
  useCanvasStore.getState().setEditing(false);
  useStore.setState({ elements: [], elementsMap: new Map() } as never);
});

describe("useTextEdit — 편집 플래그 회수", () => {
  it("편집 중 언마운트되면 isEditing 을 false 로 되돌린다", () => {
    useStore.setState({
      elements: [TEXT_ELEMENT],
      elementsMap: new Map([[TEXT_ELEMENT.id, TEXT_ELEMENT]]),
    } as never);

    const { result, unmount } = renderHook(() => useTextEdit());

    act(() => {
      result.current.startEdit(TEXT_ELEMENT.id);
    });
    expect(useCanvasStore.getState().isEditing).toBe(true);

    // completeEdit / cancelEdit 없이 사라지는 경로
    unmount();

    expect(useCanvasStore.getState().isEditing).toBe(false);
  });

  it("편집을 시작한 적이 없으면 언마운트가 플래그를 건드리지 않는다", () => {
    // 다른 소유자가 편집 중인 상태를 가로채 내리지 않는지 확인
    useCanvasStore.getState().setEditing(true, "someone-else");

    const { unmount } = renderHook(() => useTextEdit());
    unmount();

    expect(useCanvasStore.getState().isEditing).toBe(true);
  });
});
