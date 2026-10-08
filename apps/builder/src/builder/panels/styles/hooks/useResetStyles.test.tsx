// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  openStylesFixture,
  type StylesFixture,
} from "../__tests__/support/catalogStylesFixture";
import { useLayoutValues } from "./useLayoutValues";
import { useHasDirtyStyles, useResetStyles } from "./useResetStyles";
import * as preset from "../utils/specPresetResolver";

/**
 * ADR-248 4e-9 C: dirty (the section reset button) and reset over the catalog Styles host. Dirty is
 * what the selection authors at the active breakpoint — a default is never authored, so the old
 * store's false-dirty mirrors (factory inline ↔ baseline, sub-part parent context) have nothing to
 * mirror; the audits below keep the outcome: a fresh palette node is not dirty. Paint layers are
 * counted by the Fill section itself (`fills.length > 0`), not as `backgroundColor` style dirt.
 */
const LAYOUT_DIRTY_PROPS = ["display", "flexDirection", "gap"];

function dirtyOf(fixture: StylesFixture, properties: string[]) {
  return renderHook(() => useHasDirtyStyles(properties), {
    wrapper: fixture.wrapper,
  });
}

function resetOf(fixture: StylesFixture) {
  return renderHook(() => useResetStyles(), { wrapper: fixture.wrapper })
    .result;
}

afterEach(() => vi.restoreAllMocks());

describe("useResetStyles — spec preset dirty regression", () => {
  it("신규 TagGroup(style 없음) 은 Layout dirty=false 이고 spec fallback 값을 보여준다", async () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      display: "flex",
      flexDirection: "column",
      gap: 2,
    });
    const fixture = await openStylesFixture([{ id: "tg", type: "TagGroup" }], {
      select: "tg",
    });
    expect(dirtyOf(fixture, LAYOUT_DIRTY_PROPS).result.current).toBe(false);
    const record = fixture.recordOf("tg");
    const values = renderHook(() => useLayoutValues(record), {
      wrapper: fixture.wrapper,
    }).result.current;
    expect(values?.display).toBe("flex");
    expect(values?.flexDirection).toBe("column");
    expect(values?.gap).toBe("2px");
  });

  it("inline override 후에는 Layout dirty=true 로, reset 후 fallback 으로 돌아간다", async () => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      display: "flex",
      flexDirection: "column",
      gap: 2,
    });
    const fixture = await openStylesFixture(
      [{ id: "tg", type: "TagGroup", style: { flexDirection: "row" } }],
      { select: "tg" },
    );
    const dirty = dirtyOf(fixture, LAYOUT_DIRTY_PROPS);
    expect(dirty.result.current).toBe(true);

    const reset = resetOf(fixture);
    act(() => {
      reset.current(LAYOUT_DIRTY_PROPS);
    });
    dirty.rerender();
    expect(dirty.result.current).toBe(false);
    expect(fixture.styleOf("tg").flexDirection).toBeUndefined();
  });
});

describe("useResetStyles — 신규 팔레트 노드는 dirty 가 아니다", () => {
  const cases = [
    { type: "Checkbox", properties: ["display", "flexDirection"] },
    { type: "Slider", properties: ["height", "width", "maxWidth"] },
    { type: "Switch", properties: ["display", "flexDirection"] },
    { type: "Card", properties: ["gap", "padding", "borderWidth"] },
    {
      type: "Label",
      properties: ["height", "fontSize", "fontWeight", "width"],
    },
    { type: "Form", properties: ["display", "flexDirection", "gap"] },
    { type: "NumberField", properties: ["display"] },
    { type: "ColorPicker", properties: ["display", "flexDirection", "gap"] },
    { type: "ColorSwatch", properties: ["display", "borderWidth"] },
    {
      type: "DropZone",
      properties: [
        "display",
        "flexDirection",
        "alignItems",
        "justifyContent",
        "borderWidth",
      ],
    },
    { type: "Skeleton", properties: ["width", "height", "borderRadius"] },
    {
      type: "TagGroup",
      properties: ["width", "height", "minWidth", "maxWidth"],
    },
    { type: "Image", properties: ["width", "height", "borderRadius"] },
    { type: "Toast", properties: ["borderRadius", "width", "padding"] },
    { type: "TextField", properties: ["width"] },
    { type: "SearchField", properties: ["width"] },
    { type: "TextArea", properties: ["width"] },
    { type: "ColorField", properties: ["flexDirection", "display"] },
    { type: "Heading", properties: ["fontSize", "fontWeight", "lineHeight"] },
  ] as const;

  it.each(cases)("신규 $type 는 dirty=false", async ({ type, properties }) => {
    const fixture = await openStylesFixture([{ id: "node", type }], {
      select: "node",
    });
    expect(dirtyOf(fixture, [...properties]).result.current).toBe(false);
  });

  // Select-family sub-part (field 의 control Group · SelectValue · SelectIcon · DateInput): 원본 template 의
  //   자리도 사용자가 쓴 것이 없으면 dirty 가 아니다. (Select 의 trigger 는 Button 원본의 instance — ADR-253.)
  it.each([
    ["Select", "Button"],
    ["Select", "SelectValue"],
    ["ComboBox", "Group"],
    ["DatePicker", "DateInput"],
    ["DateField", "DateInput"],
    ["RadioGroup", "Radio"],
  ] as const)("%s 안 %s 는 dirty=false", async (type, part) => {
    const fixture = await openStylesFixture([{ id: "field", type }]);
    fixture.workspace.selectRecords([fixture.descendantRecord("field", part)]);
    expect(
      dirtyOf(fixture, ["width", "display", "flexDirection", "gap", "height"])
        .result.current,
    ).toBe(false);
  });
});

describe("useResetStyles — ADR-154 non-desktop breakpoint dirty/reset", () => {
  async function openWithMobileGap() {
    const fixture = await openStylesFixture(
      [
        {
          id: "frame",
          style: { display: "flex" },
          responsive: { mobile: { rowGap: "20px", columnGap: "20px" } },
        },
      ],
      { select: "frame" },
    );
    return fixture;
  }

  it("mobile 의 자기 layer 값은 dirty, desktop 은 base 기준", async () => {
    const fixture = await openWithMobileGap();
    fixture.setBreakpoint("mobile");
    const dirty = dirtyOf(fixture, ["rowGap", "columnGap"]);
    expect(dirty.result.current).toBe(true);
    act(() => fixture.setBreakpoint("desktop"));
    dirty.rerender();
    expect(dirty.result.current).toBe(false);
  });

  it("다른 tier(tablet) 의 값은 mobile 에서 dirty 아님 (자기 tier 만)", async () => {
    const fixture = await openStylesFixture(
      [{ id: "frame", responsive: { tablet: { rowGap: "12px" } } }],
      { select: "frame" },
    );
    fixture.setBreakpoint("mobile");
    expect(dirtyOf(fixture, ["rowGap"]).result.current).toBe(false);
  });

  it("reset: mobile 에서 그 layer 값을 지운다 (base 무변경)", async () => {
    const fixture = await openWithMobileGap();
    fixture.setBreakpoint("mobile");
    const reset = resetOf(fixture);
    act(() => {
      reset.current(["rowGap", "columnGap"]);
    });
    expect(fixture.styleOf("frame").rowGap).toBeUndefined();
    fixture.setBreakpoint("desktop");
    expect(fixture.styleOf("frame").display).toBe("flex");
  });
});

describe("useResetStyles — instance 안 자식", () => {
  it("reset 은 instance 의 덮어쓰기를 지우고 component 값으로 돌아간다", async () => {
    const fixture = await openStylesFixture([
      { id: "form" },
      {
        id: "field-1",
        type: "TextField",
        parent: "form",
        style: { width: "100px" },
      },
    ]);
    const instance = fixture.componentize("form", "Form");
    const child = fixture.workspace.root.domInputs.get(instance)!.children[0]!;
    fixture.workspace.selectRecords([child]);
    fixture.host.updateStyle("width", "240px");
    expect(fixture.host.readSelectedTarget().style.width).toBe("240px");

    const reset = resetOf(fixture);
    act(() => {
      reset.current(["width"]);
    });

    expect(fixture.host.readSelectedTarget().style.width).toBe("100px");
  });
});
