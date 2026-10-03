// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openStylesFixture,
  type StylesFixture,
  type StylesFixtureNode,
} from "../__tests__/support/catalogStylesFixture";
import { useStyleActions } from "./useStyleActions";

vi.mock("../../../hooks/useCopyPaste", () => ({
  useCopyPaste: () => ({
    copy: vi.fn(),
    paste: vi.fn(),
  }),
}));

/**
 * ADR-248 4e-9 C: the style actions over the catalog Styles host. The old store actions the tests
 * spied on are the host's writes (`updateStyles` · `updateProperty` · `updateProperties`), spied
 * with their real effect kept.
 */
let fixture: StylesFixture;

async function setup(nodes: StylesFixtureNode[], select: string) {
  fixture = await openStylesFixture(nodes, { select });
  return {
    updateSelectedStyles: vi.spyOn(fixture.host, "updateStyles"),
    updateSelectedProperty: vi.spyOn(fixture.host, "updateProperty"),
    updateSelectedProperties: vi.spyOn(fixture.host, "updateProperties"),
    updatePropertiesWithStyles: vi.spyOn(
      fixture.host,
      "updatePropertiesWithStyles",
    ),
  };
}

function actions() {
  return renderHook(() => useStyleActions(), { wrapper: fixture.wrapper });
}

describe("useStyleActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes explicit row flexDirection when applying container alignment", async () => {
    const { updateSelectedStyles } = await setup([{ id: "el1" }], "el1");

    const { result } = actions();

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

  it("preserveMainAxis — Space 분산 중에는 교차축 alignItems 만 쓰고 justifyContent 를 남긴다", async () => {
    const { updateSelectedStyles } = await setup([{ id: "el1" }], "el1");
    const { result } = actions();

    act(() => {
      result.current.handleFlexAlignment("centerBottom", "row", {
        preserveMainAxis: true,
      });
    });
    expect(updateSelectedStyles).toHaveBeenCalledWith({
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-end",
    });

    act(() => {
      result.current.handleFlexAlignment("rightCenter", "column", {
        preserveMainAxis: true,
      });
    });
    expect(updateSelectedStyles).toHaveBeenLastCalledWith({
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
    });
  });

  // 그룹 축 prop derive 컨테이너 direction 양방향 동기화 (2026-06-30)
  // 그룹 root flexDirection SSOT 가 별도 prop 인 컨테이너는 direction 토글 편집을
  // style 이 아닌 그 prop 으로 번역해 기록한다:
  //  - orientation (ToggleButtonGroup/Toolbar): column→vertical / row→horizontal
  //  - labelPosition (RadioGroup/CheckboxGroup/field 8종/TagGroup/ComboBox/Select/
  //    DateRangePicker): column→top / row→side
  // 전부 렌더 SSOT 가 동일한 catalog containerVariants(label-position.side flex-row)라
  // 동형. ButtonGroup 은 SSOT 가 정반대(style.flexDirection)라 제외, Form 은 labelPosition
  // 이 자식 상속 hint(그룹 root derive 아님)라 제외.
  describe("handleFlexDirection — 그룹 축 prop derive 컨테이너 동기화", () => {
    function setupSelection(type: string) {
      return setup([{ id: "el1", type }], "el1");
    }
    // element.type 은 PascalCase 로 저장된다(실데이터 = "ToggleButtonGroup").
    // 소문자로 넘기면 derive 정규화 누락 회귀를 못 잡으므로 실표기 사용.
    const setupToggleButtonGroupSelection = () =>
      setupSelection("ToggleButtonGroup");

    it("column → orientation:vertical 로 번역, style 미기록", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupToggleButtonGroupSelection();
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "vertical",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("row → orientation:horizontal 로 번역, style 미기록", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupToggleButtonGroupSelection();
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "horizontal",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("block 은 패널에서 disable 되지만, 방어적으로 도달해도 horizontal 처리(예외 없음)", async () => {
      // 1차 방어는 LayoutSection 의 isDisabled={isOrientationDriven}.
      // handleFlexDirection 은 그래도 block 을 안전하게 horizontal 로 흡수해
      // style 오염(display:block) 을 막는다.
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupToggleButtonGroupSelection();
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("block");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "horizontal",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("Toolbar column → orientation:vertical 로 번역, style 미기록", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("Toolbar");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "orientation",
        "vertical",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("RadioGroup column → labelPosition:top 로 번역 (그룹 root 축), style 미기록", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("RadioGroup");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("RadioGroup row → labelPosition:side 로 번역, style 미기록", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("RadioGroup");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("CheckboxGroup column → labelPosition:top (RadioGroup 동형)", async () => {
      const { updateSelectedProperty } = await setupSelection("CheckboxGroup");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
    });

    it("TextField row → labelPosition:side 로 번역 (field 동형), style 미기록", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("TextField");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("NumberField column → labelPosition:top (field 동형)", async () => {
      const { updateSelectedProperty } = await setupSelection("NumberField");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
    });

    it("TagGroup row → labelPosition:side (chip 계열 동형)", async () => {
      const { updateSelectedProperty } = await setupSelection("TagGroup");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
    });

    it("ComboBox row → labelPosition:side (binding accepts 추가됨, field 동형)", async () => {
      const { updateSelectedProperty } = await setupSelection("ComboBox");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
    });

    it("Select column → labelPosition:top (catalog side variant 는 structure 경유로 이미 존재)", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("Select");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "top",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("DateRangePicker row → labelPosition:side (datepicker 공통 분기 동형)", async () => {
      const { updateSelectedProperty } = await setupSelection("DateRangePicker");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
    });

    it.each([
      ["ProgressBar", "row", "side"],
      ["Meter", "column", "top"],
      ["Slider", "row", "side"],
    ])(
      "%s %s → labelPosition:%s (catalog side variant + accepts — field 동형)",
      async (type, direction, expected) => {
        const { updateSelectedStyles, updateSelectedProperty } =
          await setupSelection(type);
        const { result } = actions();

        act(() => {
          result.current.handleFlexDirection(direction);
        });

        expect(updateSelectedProperty).toHaveBeenCalledWith(
          "labelPosition",
          expected,
        );
        expect(updateSelectedStyles).not.toHaveBeenCalled();
      },
    );

    it("팔레트가 만든 ref instance 는 origin 타입으로 판정한다 (TextField instance → labelPosition)", async () => {
      const { updateSelectedStyles, updateSelectedProperty } = await setup(
        [{ id: "tf", type: "TextField" }],
        "tf",
      );
      fixture.workspace.selectRecords([fixture.componentize("tf", "Field")]);
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updateSelectedProperty).toHaveBeenCalledWith(
        "labelPosition",
        "side",
      );
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    it("선택된 버튼 재클릭 (빈 선택 → undefined) 은 아무것도 쓰지 않는다", async () => {
      // ToggleButtonGroup 에 disallowEmptySelection 이 없어 재클릭이 빈 Set 을 준다. prop 번역은
      //   column 외를 side / horizontal 로 흡수하므로 가드가 없으면 top → side 로 뒤집힌다.
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("TextField");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection(undefined as unknown as string);
      });

      expect(updateSelectedProperty).not.toHaveBeenCalled();
      expect(updateSelectedStyles).not.toHaveBeenCalled();
    });

    describe("instance 안 자식 (synthetic) 선택", () => {
      async function setupSynthetic(style?: Record<string, string>) {
        const spies = await setup(
          [
            { id: "form" },
            {
              id: "field-1",
              type: "TextField",
              parent: "form",
              props: { label: "Name", labelPosition: "top" },
            },
          ],
          "form",
        );
        const instance = fixture.componentize("form", "Form");
        const child = fixture.workspace.root.domInputs.get(instance)!
          .children[0]!;
        fixture.workspace.selectRecords([child]);
        if (style) fixture.host.updateStyles(style);
        for (const spy of Object.values(spies)) spy.mockClear();
        return spies;
      }

      it("origin 타입 (TextField) 으로 판정해 labelPosition 을 쓴다", async () => {
        const { updateSelectedStyles, updateSelectedProperty } =
          await setupSynthetic();
        const { result } = actions();

        act(() => {
          result.current.handleFlexDirection("row");
        });

        expect(updateSelectedProperty).toHaveBeenCalledWith(
          "labelPosition",
          "side",
        );
        expect(updateSelectedStyles).not.toHaveBeenCalled();
      });

      it("남은 인라인 방향은 prop 과 같은 단계에서 지운다", async () => {
        const { updatePropertiesWithStyles } = await setupSynthetic({
          display: "flex",
          flexDirection: "row",
          width: "200px",
        });
        const { result } = actions();
        const depth = fixture.workspace.runtime.historyDepth.undo;

        act(() => {
          result.current.handleFlexDirection("column");
        });

        expect(updatePropertiesWithStyles).toHaveBeenCalledWith(
          { labelPosition: "top" },
          { display: "", flexDirection: "" },
        );
        expect(fixture.workspace.runtime.historyDepth.undo).toBe(depth + 1);
        const style = fixture.host.readSelectedTarget().style;
        expect(style.flexDirection).toBeUndefined();
        expect(style.width).toBe("200px");
      });
    });

    it("옛 토글이 남긴 인라인 display · flexDirection 은 같은 쓰기에서 지운다", async () => {
      const {
        updateSelectedStyles,
        updateSelectedProperty,
        updatePropertiesWithStyles,
      } = await setup(
        [
          {
            id: "el1",
            type: "ProgressBar",
            style: { display: "flex", flexDirection: "column", width: "240px" },
          },
        ],
        "el1",
      );
      updateSelectedStyles.mockClear();
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("row");
      });

      expect(updatePropertiesWithStyles).toHaveBeenCalledWith(
        { labelPosition: "side" },
        { display: "", flexDirection: "" },
      );
      expect(updateSelectedProperty).not.toHaveBeenCalled();
      expect(updateSelectedStyles).not.toHaveBeenCalled();
      expect(fixture.styleOf("el1")).toEqual({ width: "240px" });
    });

    it("라벨 위치 컨테이너의 Alignment · Space · Wrap 은 display · flexDirection 을 쓰지 않는다", async () => {
      // 방향은 labelPosition 이 정한다 — 인라인 flexDirection 은 DOM 에서 side variant 를 이긴다.
      const { updateSelectedStyles } = await setupSelection("TextField");
      const { result } = actions();

      act(() => {
        result.current.handleFlexAlignment("rightTop", "column");
      });
      expect(updateSelectedStyles).toHaveBeenLastCalledWith({
        justifyContent: "flex-start",
        alignItems: "flex-end",
      });

      act(() => {
        result.current.handleJustifyContentSpacing("space-between");
      });
      expect(updateSelectedStyles).toHaveBeenLastCalledWith({
        justifyContent: "space-between",
      });

      act(() => {
        result.current.handleFlexWrap("wrap");
      });
      expect(updateSelectedStyles).toHaveBeenLastCalledWith({
        flexWrap: "wrap",
      });
    });

    it("Form 은 그룹 root derive 아님(자식 상속 hint) → 기존 flexDirection 경로 유지", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("Form");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedStyles).toHaveBeenCalledWith({
        display: "flex",
        flexDirection: "column",
      });
      expect(updateSelectedProperty).not.toHaveBeenCalled();
    });

    it("ButtonGroup 은 SSOT 가 정반대(style.flexDirection) → 기존 경로 유지", async () => {
      // ButtonGroup 의 flexDirection SSOT 는 props.style.flexDirection(Skia/Taffy
      // 직접 read). orientation 으로 번역하면 Skia 미반영 → 새 drift. 제외 확인.
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("ButtonGroup");
      const { result } = actions();

      act(() => {
        result.current.handleFlexDirection("column");
      });

      expect(updateSelectedStyles).toHaveBeenCalledWith({
        display: "flex",
        flexDirection: "column",
      });
      expect(updateSelectedProperty).not.toHaveBeenCalled();
    });

    it("비-orientation 컨테이너(frame) 는 기존 flexDirection 경로 유지", async () => {
      const { updateSelectedStyles, updateSelectedProperty } =
        await setupSelection("frame");
      const { result } = actions();

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

  describe("inline-flex 보존 — outer inline 을 block 으로 바꾸지 않는다", () => {
    async function setupStyled(type: string, style: Record<string, string> = {}) {
      return (await setup([{ id: "el1", type, style }], "el1"))
        .updateSelectedStyles;
    }

    it("catalog 기본이 inline-flex 인 Button — 정렬 · Direction · Space · Wrap 이 display 를 쓰지 않는다", async () => {
      const updateSelectedStyles = await setupStyled("Button");
      const { result } = actions();
      act(() => {
        result.current.handleFlexAlignment("centerCenter", "row");
        result.current.handleFlexDirection("column");
        result.current.handleJustifyContentSpacing("space-between");
        result.current.handleFlexWrap("wrap");
      });
      expect(updateSelectedStyles).toHaveBeenCalledTimes(4);
      for (const [patch] of updateSelectedStyles.mock.calls) {
        expect(patch).not.toHaveProperty("display");
      }
    });

    it("ref instance 는 origin 인라인 inline-flex 를, tablet 은 그 tier 값을 본다 (패널 표시와 같은 해석)", async () => {
      const { updateSelectedStyles } = await setup(
        [
          { id: "origin", style: { display: "inline-flex" } },
          { id: "el1", style: { display: "block" } },
        ],
        "origin",
      );
      fixture.workspace.selectRecords([fixture.componentize("origin", "Row")]);
      const { result } = actions();
      act(() => {
        result.current.handleFlexAlignment("leftTop", "row");
      });
      expect(updateSelectedStyles.mock.calls[0]![0]).not.toHaveProperty(
        "display",
      );

      fixture.select("el1");
      fixture.setBreakpoint("tablet");
      fixture.host.updateStyle("display", "inline-flex");
      updateSelectedStyles.mockClear();
      act(() => {
        result.current.handleFlexAlignment("leftTop", "row");
      });
      expect(updateSelectedStyles.mock.calls[0]![0]).not.toHaveProperty(
        "display",
      );
      fixture.setBreakpoint("desktop");
    });

    it("인라인 inline-flex 도 보존 · block 요소는 종전대로 flex 를 쓴다", async () => {
      let updateSelectedStyles = await setupStyled("frame", { display: "inline-flex" });
      const { result } = actions();
      act(() => {
        result.current.handleFlexAlignment("leftTop", "row");
      });
      expect(updateSelectedStyles.mock.calls[0][0]).not.toHaveProperty(
        "display",
      );
      updateSelectedStyles = await setupStyled("frame", { display: "block" });
      const second = actions().result;
      act(() => {
        second.current.handleFlexAlignment("leftTop", "row");
      });
      expect(updateSelectedStyles.mock.calls[0][0]).toMatchObject({
        display: "flex",
      });
    });
  });
});
