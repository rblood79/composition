// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../../stores";
import type { Element } from "../../../../types/core/store.types";
import { useStyleActions } from "./useStyleActions";

vi.mock("@/builder/hooks", () => ({
  useCopyPaste: () => ({
    copy: vi.fn(),
    paste: vi.fn(),
  }),
}));

describe("useStyleActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes explicit row flexDirection when applying container alignment", () => {
    const updateSelectedStyles = vi.fn();
    useStore.setState({ updateSelectedStyles });

    const { result } = renderHook(() => useStyleActions());

    act(() => {
      result.current.handleFlexAlignment("leftTop", "row");
    });

    expect(updateSelectedStyles).toHaveBeenCalledWith({
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-start",
      alignItems: "flex-start",
    });
  });

  // orientation-SSOT 컨테이너 direction → orientation 양방향 동기화 (2026-06-30)
  // flexDirection SSOT 가 props.orientation 으로 일원화된 컨테이너
  // (ToggleButtonGroup / Toolbar)는 direction 토글 편집을 style 이 아닌
  // orientation prop 으로 번역해 기록한다. ButtonGroup 은 SSOT 가 정반대라 제외.
  describe("handleFlexDirection — orientation-SSOT 컨테이너 동기화", () => {
    function setupSelection(type: string) {
      const updateSelectedStyles = vi.fn();
      const updateSelectedProperty = vi.fn();
      useStore.setState({
        selectedElementId: "el1",
        elementsMap: new Map<string, Element>([
          ["el1", { id: "el1", type, props: {} } as Element],
        ]),
        updateSelectedStyles,
        updateSelectedProperty,
      });
      return { updateSelectedStyles, updateSelectedProperty };
    }
    // element.type 은 PascalCase 로 저장된다(실데이터 = "ToggleButtonGroup").
    // 소문자로 넘기면 derive 정규화 누락 회귀를 못 잡으므로 실표기 사용.
    const setupToggleButtonGroupSelection = () =>
      setupSelection("ToggleButtonGroup");

    it("column → orientation:vertical 로 번역, style 미기록", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupToggleButtonGroupSelection();
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "vertical",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("row → orientation:horizontal 로 번역, style 미기록", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupToggleButtonGroupSelection();
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "horizontal",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("block 은 패널에서 disable 되지만, 방어적으로 도달해도 horizontal 처리(예외 없음)", () => {
      // 1차 방어는 LayoutSection 의 isDisabled={isOrientationDriven}.
      // handleFlexDirection 은 그래도 block 을 안전하게 horizontal 로 흡수해
      // style 오염(display:block) 을 막는다.
      const { updateSelectedStyles, updateSelectedProperty } =
        setupToggleButtonGroupSelection();
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("block");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "horizontal",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("Toolbar column → orientation:vertical 로 번역, style 미기록", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("Toolbar");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "vertical",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("ButtonGroup 은 SSOT 가 정반대(style.flexDirection) → 기존 경로 유지", () => {
      // ButtonGroup 의 flexDirection SSOT 는 props.style.flexDirection(Skia/Taffy
      // 직접 read). orientation 으로 번역하면 Skia 미반영 → 새 drift. 제외 확인.
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("ButtonGroup");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedStyles).toHaveBeenCalledWith({
        display: "flex",
        flexDirection: "column",
      });
      expect(updateSelectedProperty).not.toHaveBeenCalled();
    });

    it("비-orientation 컨테이너(frame) 는 기존 flexDirection 경로 유지", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("frame");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedStyles).toHaveBeenCalledWith({
        display: "flex",
        flexDirection: "column",
      });
      expect(updateSelectedProperty).not.toHaveBeenCalled();
    });
  });
});
