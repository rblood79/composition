// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fromElements,
  hookOf,
  openStylesFixture,
  type StylesFixture,
} from "../__tests__/support/catalogStylesFixture";

let fixture: StylesFixture;
import { useLayoutValues } from "./useLayoutValues";
import type { Element } from "../../../../types/core/store.types";

function makeElement(
  id: string,
  type: string,
  props: Record<string, unknown>,
): Element {
  return { id, type, props };
}

async function setTestElements(elements: Element[]): Promise<void> {
  fixture = await openStylesFixture(fromElements(elements));
}

/**
 * The Layout tab's values: the authored style first, else the drawn record's effective view
 * (`catalogEffectiveStyle` — the same resolved record the Canvas and the DOM read), else the
 * panel default. No default is re-derived from the node's type rule.
 */
describe("useLayoutValues", () => {
  beforeEach(async () => {
    await setTestElements([
      makeElement("el-1", "Button", {
        size: "M",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          paddingLeft: "8px",
        },
      }),
    ]);
  });

  it("returns inline values when present", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-1");
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("column");
    expect(result.current?.gap).toBe("12px"); // inline wins
    expect(result.current?.paddingLeft).toBe("8px"); // inline wins
  });

  it("falls back to the record's effective value (as px) when inline absent — Button md padding 4 / 12", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-1");
    expect(result.current?.paddingTop).toBe("4px");
    expect(result.current?.paddingRight).toBe("12px");
    expect(result.current?.justifyContent).toBe("center");
  });

  it("falls back to default string when neither inline nor record", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-1");
    expect(result.current?.marginTop).toBe("0px");
    expect(result.current?.flexWrap).toBe("nowrap");
  });

  it("returns null when id is null", async () => {
    const { result } = hookOf(fixture, useLayoutValues, null);
    expect(result.current).toBeNull();
  });

  it("returns default-valued bundle for unknown id", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "unknown");
    expect(result.current?.display).toBe("block");
    expect(result.current?.gap).toBe("0px");
  });
});

describe("useLayoutValues — record fallback (display/flex keys)", () => {
  beforeEach(async () => {
    await setTestElements([
      makeElement("el-record-only", "Card", { size: "M", style: {} }),
      makeElement("el-inline-wins", "Card", {
        size: "M",
        style: { display: "grid", alignItems: "flex-end" },
      }),
    ]);
  });

  it("record supplies display/flexDirection/alignItems/justifyContent when inline absent (Card)", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-record-only");
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("column");
    expect(result.current?.alignItems).toBe("center");
    expect(result.current?.justifyContent).toBe("center");
  });

  it("inline value wins over the record (회귀 0 보장)", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-inline-wins");
    expect(result.current?.display).toBe("grid"); // inline
    expect(result.current?.alignItems).toBe("flex-end"); // inline
    expect(result.current?.flexDirection).toBe("column"); // record
    expect(result.current?.justifyContent).toBe("center"); // record
  });
});

// ADR-082 P1-2: padding/margin shorthand 4-way uniform fallback
// 실효 4 방향이 같으면 collapsed shorthand 입력에도 그 값이 노출되어야
// 사용자가 Panel 첫 진입에서 실제 적용된 padding/margin 을 인지 가능.
describe("useLayoutValues — ADR-082 P1-2 padding/margin shorthand 4-way uniform fallback", () => {
  beforeEach(async () => {
    await setTestElements([
      makeElement("el-uniform", "ListBox", { size: "M", style: {} }),
      makeElement("el-nonuniform", "Button", { size: "M", style: {} }),
      makeElement("el-no-padding", "TextField", { size: "M", style: {} }),
      makeElement("el-inline-pad", "ListBox", {
        size: "M",
        style: { padding: "16px" },
      }),
      makeElement("el-inline-uniform-pad", "ListBox", {
        size: "M",
        style: {
          paddingTop: 12,
          paddingRight: 12,
          paddingBottom: 12,
          paddingLeft: 12,
        },
      }),
      makeElement("el-inline-uniform-margin", "ListBox", {
        size: "M",
        style: {
          marginTop: 10,
          marginRight: 10,
          marginBottom: 10,
          marginLeft: 10,
        },
      }),
    ]);
  });

  it("4-way uniform record padding → shorthand 에 그 값 표시 (ListBox padding 4)", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-uniform");
    expect(result.current?.padding).toBe("4px");
    expect(result.current?.paddingLeft).toBe("4px");
  });

  it("4-way 비균일 (Button 4 / 12) → shorthand 는 '0px' 기본값 유지 (회귀 방지)", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-nonuniform");
    expect(result.current?.padding).toBe("0px");
    expect(result.current?.paddingTop).toBe("4px");
    expect(result.current?.paddingLeft).toBe("12px");
  });

  it("record 에 padding 이 없으면 0 — TextField 루트는 자식 Input 의 size padding 12 를 받지 않는다 (2026-10-09)", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-no-padding");
    expect(result.current?.padding).toBe("0px");
    expect(result.current?.paddingLeft).toBe("0px");
    expect(result.current?.paddingRight).toBe("0px");
  });

  it("inline s.padding 은 여전히 최우선 (4-way 무시)", async () => {
    const { result } = hookOf(fixture, useLayoutValues, "el-inline-pad");
    expect(result.current?.padding).toBe("16px"); // inline
  });

  it("inline padding longhand 4-way uniform 도 shorthand 에 복원된다", async () => {
    const { result } = hookOf(
      fixture,
      useLayoutValues,
      "el-inline-uniform-pad",
    );
    expect(result.current?.padding).toBe("12px");
    expect(result.current?.paddingTop).toBe("12px"); // catalog 은 길이를 px 로 저장
  });

  it("inline margin longhand 4-way uniform 도 shorthand 에 복원된다", async () => {
    const { result } = hookOf(
      fixture,
      useLayoutValues,
      "el-inline-uniform-margin",
    );
    expect(result.current?.margin).toBe("10px");
    expect(result.current?.marginLeft).toBe("10px");
  });
});

// ADR-154 Bug: 비-desktop breakpoint 에서 편집한 style 이 재선택 시 Panel 에 미표시.
//   표시값도 activeBreakpoint 기준 responsive 를 merge 해야 재선택 시 편집값이 보인다
//   (canvas render 와 동일 SSOT).
describe("useLayoutValues — ADR-154 responsive override 표시", () => {
  function makeResponsiveElement(id: string, responsive: unknown): Element {
    return {
      id,
      type: "Frame",
      props: { style: {} },
      responsive,
    } as unknown as Element;
  }

  beforeEach(async () => {
    // gap:20 을 mobile 에서 편집한 실제 저장 shape (longhand 분배 + 숫자 변환)
    await setTestElements([
      makeResponsiveElement("el-resp", {
        styles: {
          rowGap: { mobile: 20 },
          columnGap: { mobile: 20 },
        },
      }),
    ]);
  });

  afterEach(async () => {
    fixture?.setBreakpoint("desktop");
  });

  it("mobile breakpoint 에서 responsive rowGap override 를 gap 으로 표시", async () => {
    fixture?.setBreakpoint("mobile");
    const { result } = hookOf(fixture, useLayoutValues, "el-resp");
    // responsive override (base 없음) — catalog 은 길이를 px 로 저장
    expect(result.current?.gap).toBe("20px");
  });

  it("desktop breakpoint 에서는 responsive 를 무시하고 base/record 표시", async () => {
    fixture?.setBreakpoint("desktop");
    const { result } = hookOf(fixture, useLayoutValues, "el-resp");
    expect(result.current?.gap).toBe("0px"); // Frame record 에 gap 없음 (responsive 미적용)
  });
});

describe("useLayoutValues — ADR-108 P3 variant-aware Panel fallback", () => {
  it("TextField.labelPosition=side variant 를 Panel layout 값으로 반영", async () => {
    await setTestElements([
      makeElement("el-side-textfield", "TextField", {
        size: "M",
        labelPosition: "side",
        style: {},
      }),
    ]);

    const { result } = hookOf(fixture, useLayoutValues, "el-side-textfield");
    // catalog 의 label-position:side 는 grid 가 아니라 flex-row 다 — DateField/TimeField/
    // NumberField/SearchField 와 통일하면서 generated CSS 와 Skia(getSideLabelParentStyle) 의
    // 대칭까지 맞춘 의도적 변경 (ADR-913 후속 fix, 2026-06-19).
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("row");
    expect(result.current?.alignItems).toBe("flex-start");
  });

  it("inline layout 값은 variant fallback 보다 우선", async () => {
    await setTestElements([
      makeElement("el-side-textfield-inline", "TextField", {
        size: "M",
        labelPosition: "side",
        style: {
          display: "flex",
          alignItems: "center",
          rowGap: "24px",
        },
      }),
    ]);

    const { result } = hookOf(
      fixture,
      useLayoutValues,
      "el-side-textfield-inline",
    );
    expect(result.current?.display).toBe("flex");
    expect(result.current?.alignItems).toBe("center");
    expect(result.current?.gap).toBe("24px");
  });

  it("TagGroup 기본 방향은 수동 CSS와 동일하게 column으로 표시", async () => {
    await setTestElements([
      makeElement("el-taggroup", "TagGroup", {
        size: "M",
        labelPosition: "top",
        style: {},
      }),
    ]);

    const { result } = hookOf(fixture, useLayoutValues, "el-taggroup");
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("column");
  });

  it("TagGroup.labelPosition=side variant 는 Direction 을 row로 표시", async () => {
    await setTestElements([
      makeElement("el-taggroup-side", "TagGroup", {
        size: "M",
        labelPosition: "side",
        style: {},
      }),
    ]);

    const { result } = hookOf(fixture, useLayoutValues, "el-taggroup-side");
    expect(result.current?.display).toBe("flex");
    expect(result.current?.flexDirection).toBe("row");
    expect(result.current?.alignItems).toBe("flex-start");
  });
});
