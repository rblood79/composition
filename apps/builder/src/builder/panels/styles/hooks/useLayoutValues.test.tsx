// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLayoutValues } from "./useLayoutValues";
import { useStore } from "../../../stores";
import { seedPanelElements } from "./__tests__/panelFixture";
import type { Element } from "../../../../types/core/store.types";
import * as preset from "../utils/specPresetResolver";

function makeElement(
  id: string,
  type: string,
  props: Record<string, unknown>,
): Element {
  return { id, type, props };
}

function setTestElements(elements: Element[]): void {
  seedPanelElements(elements);
}

describe("useLayoutValues", () => {
  beforeEach(() => {
    setTestElements([
      makeElement("el-1", "Button", {
        size: "md",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          paddingLeft: "8px",
        },
      }),
    ]);
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      gap: 4,
      paddingTop: 6,
      paddingRight: 10,
      paddingBottom: 6,
      paddingLeft: 10,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns inline values when present", () => {
    const { result } = renderHook(() => useLayoutValues("el-1"));
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("column");
    expect(result.current?.gap).toBe("12px"); // inline wins
    expect(result.current?.paddingLeft).toBe("8px"); // inline wins
  });

  it("falls back to spec preset (as px) when inline absent", () => {
    const { result } = renderHook(() => useLayoutValues("el-1"));
    expect(result.current?.paddingTop).toBe("6px"); // spec
    expect(result.current?.paddingRight).toBe("10px"); // spec
  });

  it("falls back to default string when neither inline nor spec", () => {
    const { result } = renderHook(() => useLayoutValues("el-1"));
    expect(result.current?.marginTop).toBe("0px");
    expect(result.current?.justifyContent).toBe("");
    expect(result.current?.flexWrap).toBe("nowrap");
  });

  it("returns null when id is null", () => {
    const { result } = renderHook(() => useLayoutValues(null));
    expect(result.current).toBeNull();
  });

  it("returns default-valued bundle for unknown id", () => {
    const { result } = renderHook(() => useLayoutValues("unknown"));
    expect(result.current?.display).toBe("block");
    expect(result.current?.padding).toBe("0px");
  });
});

describe("useLayoutValues — ADR-082 P3 spec fallback (display/flex keys)", () => {
  beforeEach(() => {
    setTestElements([
      makeElement("el-spec-only", "ListBox", { size: "md", style: {} }),
      makeElement("el-inline-wins", "ListBox", {
        size: "md",
        style: { display: "grid", alignItems: "center" },
      }),
    ]);
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "center",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("spec preset supplies display/flexDirection/alignItems/justifyContent when inline absent", () => {
    const { result } = renderHook(() => useLayoutValues("el-spec-only"));
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("column");
    expect(result.current?.alignItems).toBe("flex-start");
    expect(result.current?.justifyContent).toBe("center");
  });

  it("inline value wins over spec preset (회귀 0 보장)", () => {
    const { result } = renderHook(() => useLayoutValues("el-inline-wins"));
    expect(result.current?.display).toBe("grid"); // inline
    expect(result.current?.alignItems).toBe("center"); // inline
    expect(result.current?.flexDirection).toBe("column"); // spec fallback
    expect(result.current?.justifyContent).toBe("center"); // spec fallback
  });
});

// ADR-082 P1-2: padding/margin shorthand 4-way uniform fallback
// Spec 이 4 방향 동일한 값을 공급하면 collapsed shorthand 입력에도 그 값이 노출되어야
// 사용자가 Panel 첫 진입에서 실제 적용된 padding/margin 을 인지 가능.
describe("useLayoutValues — ADR-082 P1-2 padding/margin shorthand 4-way uniform fallback", () => {
  beforeEach(() => {
    setTestElements([
      makeElement("el-uniform", "ListBox", { size: "md", style: {} }),
      makeElement("el-nonuniform", "Menu", { size: "md", style: {} }),
      makeElement("el-inline-pad", "ListBox", {
        size: "md",
        style: { padding: "16px" },
      }),
      makeElement("el-inline-uniform-pad", "ListBox", {
        size: "md",
        style: {
          paddingTop: 12,
          paddingRight: 12,
          paddingBottom: 12,
          paddingLeft: 12,
        },
      }),
      makeElement("el-inline-uniform-margin", "ListBox", {
        size: "md",
        style: {
          marginTop: 10,
          marginRight: 10,
          marginBottom: 10,
          marginLeft: 10,
        },
      }),
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  it("4-way uniform spec padding → shorthand 에 그 값 표시 (ListBox paddingX/Y=4)", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      paddingTop: 4,
      paddingRight: 4,
      paddingBottom: 4,
      paddingLeft: 4,
    });
    const { result } = renderHook(() => useLayoutValues("el-uniform"));
    expect(result.current?.padding).toBe("4px");
  });

  it("4-way 비균일 → shorthand 는 '0px' 기본값 유지 (회귀 방지)", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      paddingTop: 4,
      paddingRight: 8,
      paddingBottom: 4,
      paddingLeft: 8,
    });
    const { result } = renderHook(() => useLayoutValues("el-nonuniform"));
    expect(result.current?.padding).toBe("0px");
  });

  it("inline s.padding 은 여전히 최우선 (4-way 무시)", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      paddingTop: 4,
      paddingRight: 4,
      paddingBottom: 4,
      paddingLeft: 4,
    });
    const { result } = renderHook(() => useLayoutValues("el-inline-pad"));
    expect(result.current?.padding).toBe("16px"); // inline
  });

  it("margin 도 동일 — 4-way uniform 이면 shorthand 에 반영", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      marginTop: 8,
      marginRight: 8,
      marginBottom: 8,
      marginLeft: 8,
    });
    const { result } = renderHook(() => useLayoutValues("el-uniform"));
    expect(result.current?.margin).toBe("8px");
  });

  it("inline padding longhand 4-way uniform 도 shorthand 에 복원된다", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({});
    const { result } = renderHook(() =>
      useLayoutValues("el-inline-uniform-pad"),
    );
    expect(result.current?.padding).toBe("12px");
    expect(result.current?.paddingTop).toBe("12");
  });

  it("inline margin longhand 4-way uniform 도 shorthand 에 복원된다", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({});
    const { result } = renderHook(() =>
      useLayoutValues("el-inline-uniform-margin"),
    );
    expect(result.current?.margin).toBe("10px");
    expect(result.current?.marginLeft).toBe("10");
  });

  it("4-way 중 일부만 정의되고 나머지 undefined → shorthand 는 기본값", () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      paddingTop: 4,
      paddingRight: 4,
      // paddingBottom, paddingLeft 미정의
    });
    const { result } = renderHook(() => useLayoutValues("el-uniform"));
    expect(result.current?.padding).toBe("0px");
  });
});

// ADR-154 Bug: 비-desktop breakpoint 에서 편집한 style 이 재선택 시 Panel 에 미표시.
//   write 경로(updateSelectedStyle)는 activeBreakpoint !== "desktop" 이면
//   element.responsive.styles 로 저장하는데, 표시 경로(useElementStyleContext)는
//   props.style(base) 만 읽어 responsive override 를 놓쳤다. 표시값도 activeBreakpoint
//   기준 responsive 를 merge 해야 재선택 시 편집값이 보인다 (canvas render 와 동일 SSOT).
describe("useLayoutValues — ADR-154 responsive override 표시", () => {
  function makeResponsiveElement(id: string, responsive: unknown): Element {
    return {
      id,
      type: "Frame",
      props: { size: "md", style: {} },
      responsive,
    } as unknown as Element;
  }

  beforeEach(() => {
    // gap:20 을 mobile 에서 편집한 실제 저장 shape (longhand 분배 + 숫자 변환)
    setTestElements([
      makeResponsiveElement("el-resp", {
        styles: {
          rowGap: { mobile: 20 },
          columnGap: { mobile: 20 },
        },
      }),
    ]);
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({ gap: 4 });
  });

  afterEach(() => {
    useStore.setState({ activeBreakpoint: "desktop" } as never);
    vi.restoreAllMocks();
  });

  it("mobile breakpoint 에서 responsive rowGap override 를 gap 으로 표시", () => {
    useStore.setState({ activeBreakpoint: "mobile" } as never);
    const { result } = renderHook(() => useLayoutValues("el-resp"));
    // firstDefined 가 String(20) → "20" (responsive override, base 없음·spec "4px" 아님)
    expect(result.current?.gap).toBe("20");
  });

  it("desktop breakpoint 에서는 responsive 를 무시하고 base/spec 표시", () => {
    useStore.setState({ activeBreakpoint: "desktop" } as never);
    const { result } = renderHook(() => useLayoutValues("el-resp"));
    expect(result.current?.gap).toBe("4px"); // spec fallback (responsive 미적용)
  });
});

describe("useLayoutValues — ADR-108 P3 variant-aware Panel fallback", () => {
  afterEach(() => vi.restoreAllMocks());

  it("TextField.labelPosition=side variant 를 Panel layout 값으로 반영", () => {
    setTestElements([
      makeElement("el-side-textfield", "TextField", {
        size: "md",
        labelPosition: "side",
        style: {},
      }),
    ]);

    const { result } = renderHook(() => useLayoutValues("el-side-textfield"));
    // catalog 의 label-position:side 는 grid 가 아니라 flex-row 다 — DateField/TimeField/
    // NumberField/SearchField 와 통일하면서 generated CSS 와 Skia(getSideLabelParentStyle) 의
    // 대칭까지 맞춘 의도적 변경 (ADR-913 후속 fix, 2026-06-19).
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("row");
    expect(result.current?.alignItems).toBe("flex-start");
  });

  it("inline layout 값은 variant fallback 보다 우선", () => {
    setTestElements([
      makeElement("el-side-textfield-inline", "TextField", {
        size: "md",
        labelPosition: "side",
        style: {
          display: "flex",
          alignItems: "center",
          rowGap: "24px",
        },
      }),
    ]);

    const { result } = renderHook(() =>
      useLayoutValues("el-side-textfield-inline"),
    );
    expect(result.current?.display).toBe("flex");
    expect(result.current?.alignItems).toBe("center");
    expect(result.current?.gap).toBe("24px");
  });

  it("TagGroup 기본 방향은 수동 CSS와 동일하게 column으로 표시", () => {
    setTestElements([
      makeElement("el-taggroup", "TagGroup", {
        size: "md",
        labelPosition: "top",
        style: {},
      }),
    ]);

    const { result } = renderHook(() => useLayoutValues("el-taggroup"));
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("column");
  });

  it("TagGroup.labelPosition=side variant 는 Direction 을 row로 표시", () => {
    setTestElements([
      makeElement("el-taggroup-side", "TagGroup", {
        size: "md",
        labelPosition: "side",
        style: {},
      }),
    ]);

    const { result } = renderHook(() => useLayoutValues("el-taggroup-side"));
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("row");
    expect(result.current?.alignItems).toBe("flex-start");
  });
});
