// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useLayoutPresentationActions } from "./useLayoutPresentationActions";
import { useTextMetricsPresentationActions } from "./useTextMetricsPresentationActions";

const state = vi.hoisted(() => ({
  selectedElementId: "a",
  subscribers: new Set<() => void>(),
  begin: vi.fn(),
}));
vi.mock("../../../stores", () => ({
  readImmediateSelectionSnapshot: () => ({
    selectedElementId: state.selectedElementId,
  }),
  useStore: {
    subscribe: (listener: () => void) => {
      state.subscribers.add(listener);
      return () => state.subscribers.delete(listener);
    },
  },
}));
vi.mock("../../../presentation/editorPresentationFillPilot", () => ({
  editorPresentationFillPilotRuntime: { beginEditorPresentation: state.begin },
}));
vi.mock("../../../presentation/editorPresentationLayoutPilot", () => ({
  parsePresentationLayoutPx: (value: string) => Number.parseFloat(value),
  resolveLayoutPresentationPilotTarget: () => ({
    projectId: "project",
    target: {},
  }),
}));
vi.mock("../../../presentation/editorPresentationTextMetrics", () => ({
  parsePresentationFontSize: (value: string) => Number.parseFloat(value),
  parsePresentationFontWeight: (value: string) => Number.parseFloat(value),
  resolveTextMetricPresentationPilotTarget: () => ({
    projectId: "project",
    target: {},
  }),
}));

const cases = [
  {
    name: "layout",
    useActions: () => {
      const a = useLayoutPresentationActions();
      return {
        preview: () => a.previewLayoutPresentation("width", "24px"),
        previewOther: () => a.previewLayoutPresentation("height", "24px"),
        commit: () => a.commitLayoutPresentation("width", "24px"),
      };
    },
  },
  {
    name: "text",
    useActions: () => {
      const a = useTextMetricsPresentationActions();
      return {
        preview: () => a.previewTextMetricPresentation("fontSize", "24px"),
        previewOther: () =>
          a.previewTextMetricPresentation("fontWeight", "600"),
        commit: () => a.commitTextMetricPresentation("fontSize", "24px"),
      };
    },
  },
];

beforeEach(() => {
  state.selectedElementId = "a";
  state.subscribers.clear();
  state.begin.mockReset().mockImplementation(() => ({
    cancel: vi.fn(),
    publish: vi.fn().mockReturnValue(true),
    finish: vi.fn().mockReturnValue({ status: "committed" }),
  }));
});
afterEach(cleanup);

for (const scenario of cases) {
  describe(`${scenario.name} presentation 공통 생명주기`, () => {
    it("선택 변경으로 취소된 편집을 새 선택에 commit하지 않는다", () => {
      const { result } = renderHook(scenario.useActions);
      act(() => {
        result.current.preview();
      });
      const handle = state.begin.mock.results[0].value;
      act(() => {
        state.selectedElementId = "b";
        state.subscribers.forEach((notify) => notify());
        result.current.commit();
      });
      expect(handle.cancel).toHaveBeenCalledWith("selection-change");
      expect(handle.finish).not.toHaveBeenCalled();
      expect(state.begin).toHaveBeenCalledTimes(1);
    });

    it("blur는 활성 편집을 한 번 취소하고 unmount는 구독을 해제한다", () => {
      const { result, unmount } = renderHook(scenario.useActions);
      act(() => {
        result.current.preview();
      });
      const handle = state.begin.mock.results[0].value;
      act(() => {
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new Event("blur"));
      });
      expect(handle.cancel).toHaveBeenCalledExactlyOnceWith("blur");
      unmount();
      expect(handle.cancel).toHaveBeenLastCalledWith("unmount");
      expect(state.subscribers.size).toBe(0);
      handle.cancel.mockClear();
      window.dispatchEvent(new Event("blur"));
      expect(handle.cancel).not.toHaveBeenCalled();
    });

    it("취소 후 다른 속성으로 재진입하는 기존 family 정책을 보존한다", () => {
      const { result } = renderHook(scenario.useActions);
      act(() => {
        result.current.preview();
      });
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      act(() => {
        result.current.previewOther();
      });
      expect(state.begin).toHaveBeenCalledTimes(
        scenario.name === "layout" ? 2 : 1,
      );
    });
  });
}
