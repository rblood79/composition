// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../env/supabase.client", () => ({
  supabase: {},
}));

import { useStore } from "../../../stores";
import { useLayoutValues } from "./useLayoutValues";
import { useTransformValues } from "./useTransformValues";
import { useHasDirtyStyles, useResetStyles } from "./useResetStyles";
import * as preset from "../utils/specPresetResolver";
import { getDefaultProps } from "../../../../types/builder/unified.types";
import type { ComponentElementProps } from "../../../../types/builder/unified.types";
import type { Element } from "../../../../types/core/store.types";

const LAYOUT_DIRTY_PROPS = ["display", "flexDirection", "gap"];
const TRANSFORM_DIRTY_PROPS = ["width", "height", "minWidth", "maxWidth"];

function makeElement(id: string, props: Record<string, unknown>): Element {
  return {
    id,
    type: "TagGroup",
    props,
  };
}

function makeTaggedElement(
  id: string,
  type: string,
  props: Record<string, unknown>,
): Element {
  return {
    id,
    type,
    props,
  };
}

describe("useResetStyles — spec preset dirty regression", () => {
  const originalState = useStore.getState();

  beforeEach(() => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({
      display: "flex",
      flexDirection: "column",
      gap: 2,
    });

    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: vi.fn((callback: IdleRequestCallback) => {
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        } as IdleDeadline);
        return 1;
      }),
    });

    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    const element = makeElement("taggroup-1", {
      size: "md",
      labelPosition: "top",
    });

    useStore.setState({
      selectedElementId: "taggroup-1",
      selectedElementProps: element.props,
      currentPageId: null,
      elements: [element],
      elementsMap: new Map([["taggroup-1", element]]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(originalState, true);
  });

  it("신규 TagGroup(style 없음) 은 Layout dirty=false 이고 spec fallback 값을 보여준다", () => {
    const { result: dirty } = renderHook(() =>
      useHasDirtyStyles(LAYOUT_DIRTY_PROPS),
    );
    const { result: layout } = renderHook(() => useLayoutValues("taggroup-1"));
    const { result: transformDirty } = renderHook(() =>
      useHasDirtyStyles(TRANSFORM_DIRTY_PROPS),
    );
    const { result: transform } = renderHook(() =>
      useTransformValues("taggroup-1"),
    );

    expect(dirty.current).toBe(false);
    expect(transformDirty.current).toBe(false);
    expect(layout.current?.display).toBe("flex");
    expect(layout.current?.flexDirection).toBe("column");
    expect(layout.current?.gap).toBe("2px");
    expect(transform.current?.width.inline).toBeUndefined();
  });

  it("inline override 후에는 Layout dirty=true 로 전환된다", () => {
    const { result: dirty } = renderHook(() =>
      useHasDirtyStyles(LAYOUT_DIRTY_PROPS),
    );

    act(() => {
      useStore.getState().updateSelectedStyles({ gap: "12px" });
    });

    expect(dirty.current).toBe(true);
    expect(
      (
        useStore.getState().elementsMap.get("taggroup-1")?.props?.style as {
          rowGap?: number;
          columnGap?: number;
        }
      )?.rowGap,
    ).toBe(12);
    expect(
      (
        useStore.getState().elementsMap.get("taggroup-1")?.props?.style as {
          columnGap?: number;
        }
      )?.columnGap,
    ).toBe(12);
  });

  it("reset 후 inline override 를 제거하고 spec fallback 으로 복귀한다", () => {
    const { result: dirty } = renderHook(() =>
      useHasDirtyStyles(LAYOUT_DIRTY_PROPS),
    );
    const { result: layout } = renderHook(() => useLayoutValues("taggroup-1"));
    const { result: resetStyles } = renderHook(() => useResetStyles());

    act(() => {
      useStore.getState().updateSelectedStyles({ gap: "12px" });
    });

    expect(dirty.current).toBe(true);

    act(() => {
      resetStyles.current(["gap"]);
    });

    const style = useStore.getState().elementsMap.get("taggroup-1")?.props
      ?.style as Record<string, unknown> | undefined;

    expect(style?.gap).toBeUndefined();
    expect(style?.rowGap).toBeUndefined();
    expect(style?.columnGap).toBeUndefined();
    expect(dirty.current).toBe(false);
    expect(layout.current?.display).toBe("flex");
    expect(layout.current?.flexDirection).toBe("column");
    expect(layout.current?.gap).toBe("2px");
  });
});

describe("useResetStyles — default props false dirty audit", () => {
  const originalState = useStore.getState();

  const cases = [
    { type: "Checkbox", properties: ["display", "flexDirection"] },
    { type: "Radio", properties: ["display", "flexDirection"] },
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
    // TagGroup: factory + getDefaultProps 둘 다 style.width:"100%" 기본 주입(Skia 칩 wrap 대칭).
    //   두 default 소스가 일치해야 Transform width 가 default 와 동일한데도 "override" 로 오판되어
    //   리셋 버튼이 활성화되는 회귀를 막는다(2026-06-19 사용자 보고).
    {
      type: "TagGroup",
      properties: ["width", "height", "minWidth", "maxWidth"],
    },
    // SelectTrigger: 6 factory(Select/ComboBox/NumberField/SearchField/DatePicker/DateRangePicker)가
    //   모두 동일한 row-flex layout(width:100%/display:flex/flexDirection:row/alignItems:center/gap:4)
    //   을 props.style 에 주입한다(ADR-907 Layer B). catalog rule 에는 layout 필드가 없어 specStyle
    //   baseline=undefined → getDefaultProps 도 동일 layout 을 반환해야 Transform(width)/Layout
    //   (display/flexDirection/alignItems/gap) 리셋 버튼이 default 를 "override" 로 오판하지 않는다
    //   (2026-06-23 사용자 보고). createDefaultSelectTriggerProps ↔ factory 동일 값.
    {
      type: "SelectTrigger",
      properties: ["width", "display", "flexDirection", "alignItems", "gap"],
    },
  ] as const;

  beforeEach(() => {
    useStore.setState({
      selectedElementId: null,
      // Canonical migration: store type tightened selectedElementProps to
      // ComponentElementProps (non-null); runtime still resets it to null.
      selectedElementProps: null as unknown as ComponentElementProps,
      currentPageId: null,
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(originalState, true);
  });

  it.each(cases)(
    "신규 $type 는 기본 props baseline 에서 dirty=false 여야 한다",
    ({ type, properties }) => {
      const element = makeTaggedElement(
        `${type.toLowerCase()}-1`,
        type,
        getDefaultProps(type),
      );

      useStore.setState({
        selectedElementId: element.id,
        selectedElementProps: element.props,
        currentPageId: null,
        elements: [element],
        elementsMap: new Map([[element.id, element]]),
        childrenMap: new Map(),
        dirtyElementIds: new Set(),
        layoutVersion: 0,
      });

      const { result: dirty } = renderHook(() =>
        useHasDirtyStyles([...properties]),
      );
      expect(dirty.current).toBe(false);
    },
  );
});

describe("useResetStyles — layout preset baseline", () => {
  const originalState = useStore.getState();

  beforeEach(() => {
    const body = makeTaggedElement("frame-body-1", "body", {
      appliedPreset: "vertical-2",
      style: {
        display: "flex",
        flexDirection: "column",
      },
    });

    useStore.setState({
      selectedElementId: body.id,
      selectedElementProps: body.props,
      currentPageId: null,
      elements: [body],
      elementsMap: new Map([[body.id, body]]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(originalState, true);
  });

  it("preset 이 적용된 frame body 의 containerStyle 은 Layout dirty 로 보지 않는다", () => {
    const { result: dirty } = renderHook(() =>
      useHasDirtyStyles(["display", "flexDirection"]),
    );

    expect(dirty.current).toBe(false);
  });

  it("reset 은 사용자 변경만 preset baseline 으로 되돌린다", () => {
    const { result: dirty } = renderHook(() =>
      useHasDirtyStyles(["display", "flexDirection"]),
    );
    const { result: resetStyles } = renderHook(() => useResetStyles());

    act(() => {
      useStore.getState().updateSelectedStyles({ flexDirection: "row" });
    });

    expect(dirty.current).toBe(true);

    act(() => {
      resetStyles.current(["display", "flexDirection"]);
    });

    const style = useStore.getState().elementsMap.get("frame-body-1")?.props
      ?.style as Record<string, unknown> | undefined;

    expect(style?.display).toBe("flex");
    expect(style?.flexDirection).toBe("column");
    expect(dirty.current).toBe(false);
  });
});
