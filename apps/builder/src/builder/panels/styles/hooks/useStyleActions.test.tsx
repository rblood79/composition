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

  // 그룹 축 prop derive 컨테이너 direction 양방향 동기화 (2026-06-30)
  // 그룹 root flexDirection SSOT 가 별도 prop 인 컨테이너는 direction 토글 편집을
  // style 이 아닌 그 prop 으로 번역해 기록한다:
  //  - orientation (ToggleButtonGroup/Toolbar): column→vertical / row→horizontal
  //  - labelPosition (RadioGroup/CheckboxGroup/field 8종/TagGroup): column→top / row→side
  // field/TagGroup 도 렌더 SSOT 가 RadioGroup 과 동일한 catalog containerVariants
  // (label-position.side flex-row) 라 동형. ButtonGroup 은 SSOT 가 정반대
  // (style.flexDirection)라 제외, ComboBox/Select/DateRangePicker 는 binding accepts
  // 부재(편집 UI 비대칭) 또는 catalog variant 부재라 제외.
  describe("handleFlexDirection — 그룹 축 prop derive 컨테이너 동기화", () => {
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

    it("RadioGroup column → labelPosition:top 로 번역 (그룹 root 축), style 미기록", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("RadioGroup");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("RadioGroup row → labelPosition:side 로 번역, style 미기록", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("RadioGroup");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("CheckboxGroup column → labelPosition:top (RadioGroup 동형)", () => {
      const { updateSelectedProperty } = setupSelection("CheckboxGroup");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
    });

    it("TextField row → labelPosition:side 로 번역 (field 동형), style 미기록", () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("TextField");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("NumberField column → labelPosition:top (field 동형)", () => {
      const { updateSelectedProperty } = setupSelection("NumberField");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
    });

    it("TagGroup row → labelPosition:side (chip 계열 동형)", () => {
      const { updateSelectedProperty } = setupSelection("TagGroup");
      const { result } = renderHook(() => useStyleActions());

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
    });

    it("ComboBox 는 binding accepts 부재 → 기존 flexDirection 경로 유지", () => {
      // catalog 에 label-position variant 는 있으나 binding accepts 미선언이라
      // Properties dropdown 편집 UI 가 없다. Direction 토글만 prop 을 쓰면
      // 편집 진입점 비대칭 → 제외. 일반 style 경로 유지 확인.
      const { updateSelectedStyles, updateSelectedProperty } =
        setupSelection("ComboBox");
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
