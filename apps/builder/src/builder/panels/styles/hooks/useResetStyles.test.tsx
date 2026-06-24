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
    // ── 2026-06-24 Class B/C false dirty 전수조사 정정 (top-level CSS↔Skia 시각 발산 해소) ──
    // Image/Toast: factory inline borderRadius(8px, radius 토큰 스케일 외 임의값) 제거 → Skia 가
    //   catalog specProps(Image radius.none=0 / Toast radius.md=6) 를 받아 CSS Preview 와 정합
    //   (사용자 결정 = catalog 토큰 정본). factory 에 borderRadius 가 다시 들어오면 이 audit FAIL.
    { type: "Image", properties: ["width", "height", "borderRadius"] },
    { type: "Toast", properties: ["borderRadius", "width", "padding"] },
    // TextField/SearchField/TextArea: catalog composition.containerStyles.width 가 stale "fit-content"
    //   였다 → factory inline width:100% ↔ CSS Preview(fit-content) 시각 비대칭. catalog width 를
    //   100% 로 정정(field 패밀리 정본 — NumberField/DateField 는 catalog 미채움으로 이미 정합).
    { type: "TextField", properties: ["width"] },
    { type: "SearchField", properties: ["width"] },
    { type: "TextArea", properties: ["width"] },
    // ColorField: catalog 가 2026-06-23 "사용자 결정 = factory 정본" 으로 flex-row 확정됐으나 factory
    //   inline 이 flexDirection:column 으로 남아 Skia(column) ≠ CSS Preview(row) 발산. factory 를
    //   row 로 정합(catalog 가 정본). factory 가 column 으로 회귀하면 이 audit FAIL.
    { type: "ColorField", properties: ["flexDirection", "display"] },
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

/**
 * Select-family sub-part(SelectValue / SelectIcon / DateInput) 의 dirty baseline 은 **부모 컨텍스트**에
 * 의존한다(SelectTrigger 와 달리 factory inline layout 이 부모마다 다름 — CSS 부모-한정 selector / RAC
 * D1 DOM 차이가 정본). `resolveSubpartContextDefaultStyle`(useResetStyles.ts)이 부모(SelectTrigger /
 * DateField …) + 조부모(picker 등) type 으로 factory inline 미러를 baseline 에 합쳐 dirty=false 를
 * 보장한다. 값이 factory definition 과 어긋나면 이 audit 이 FAIL(동기화 가드). 2026-06-23.
 */
describe("useResetStyles — Select-family sub-part 부모-컨텍스트 dirty audit", () => {
  const originalState = useStore.getState();

  beforeEach(() => {
    useStore.setState({
      selectedElementId: null,
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

  // 각 case: sub-part(child) + 부모(parent) + 조부모(grand) 3-노드 트리 + child factory inline style.
  //   style 은 해당 factory definition 의 실제 inline 값 미러(어긋나면 FAIL → factory↔baseline 동기화).
  const cases = [
    {
      name: "picker DateInput (DatePicker > SelectTrigger > DateInput)",
      child: { type: "DateInput", style: { flex: 1, minWidth: 0 } },
      parent: "SelectTrigger",
      grand: "DatePicker",
      properties: ["flex", "minWidth", "width"],
    },
    {
      name: "DateRangePicker DateInput",
      child: { type: "DateInput", style: { flex: 1, minWidth: 0 } },
      parent: "SelectTrigger",
      grand: "DateRangePicker",
      properties: ["flex", "minWidth", "width"],
    },
    {
      name: "DateField 단독 DateInput",
      child: { type: "DateInput", style: { width: "100%" } },
      parent: "DateField",
      grand: "body",
      properties: ["width"],
    },
    {
      name: "Select SelectValue (Select > SelectTrigger > SelectValue)",
      child: {
        type: "SelectValue",
        style: { flex: 1, textAlign: "left" },
      },
      parent: "SelectTrigger",
      grand: "Select",
      properties: ["flex", "textAlign", "display"],
    },
    {
      name: "NumberField SelectValue (display:block 컨텍스트)",
      child: {
        type: "SelectValue",
        style: { display: "block", textAlign: "left" },
      },
      parent: "SelectTrigger",
      grand: "NumberField",
      properties: ["display", "textAlign", "flex"],
    },
    {
      name: "Select SelectIcon (w/h 18 + flexShrink:0)",
      child: {
        type: "SelectIcon",
        style: { width: 18, height: 18, flexShrink: 0 },
      },
      parent: "SelectTrigger",
      grand: "Select",
      properties: ["width", "height", "flexShrink"],
    },
  ] as const;

  it.each(cases)(
    "$name 는 부모-컨텍스트 baseline 에서 dirty=false",
    ({ child, parent, grand, properties }) => {
      const grandEl = makeTaggedElement("grand-1", grand, { size: "md" });
      const parentEl: Element = {
        id: "parent-1",
        type: parent,
        parent_id: grandEl.id,
        props: {},
      } as Element;
      const childEl: Element = {
        id: "child-1",
        type: child.type,
        parent_id: parentEl.id,
        props: { style: child.style },
      } as Element;

      useStore.setState({
        selectedElementId: childEl.id,
        selectedElementProps: childEl.props,
        currentPageId: null,
        elements: [grandEl, parentEl, childEl],
        elementsMap: new Map([
          [grandEl.id, grandEl],
          [parentEl.id, parentEl],
          [childEl.id, childEl],
        ]),
        childrenMap: new Map(),
        dirtyElementIds: new Set(),
        layoutVersion: 0,
      });

      const { result: dirty } = renderHook(() =>
        useHasDirtyStyles([...properties]),
      );
      expect(
        dirty.current,
        `${child.type}(부모 ${parent}/조부모 ${grand}) factory inline 이 baseline 과 어긋나 dirty 로 오판`,
      ).toBe(false);
    },
  );
});

/**
 * Label fontWeight false dirty 회귀 가드 (2026-06-24 전수조사 정정).
 *
 * 다수 factory(Form/Group/Selection/DateColor)가 필드 Label 자식에 `fontWeight:600` inline 주입.
 * catalog Label 은 fontWeight 를 `sizes` 가 아닌 `variants.default.textWeight=600`(Skia 렌더 정본)으로만
 * 보유했고, resolveTypographySpecPreset 가 sizeEntry.fontWeight 만 읽어 specStyle.fontWeight=undefined →
 * dirty baseline 이 createDefaultLabelProps(과거 500)로 fallback → factory 600 과 영구 비대칭(Typography
 * reset 버튼 false 활성). 정정: (1) resolver 가 variants.textWeight 흡수 (2) createDefaultLabelProps
 * 500→600. 값이 어긋나면 이 audit 이 FAIL(catalog textWeight ↔ createDefault ↔ factory 600 삼중 동기화 가드).
 */
describe("useResetStyles — Label fontWeight false dirty 회귀 가드", () => {
  const originalState = useStore.getState();

  beforeEach(() => {
    useStore.setState({
      selectedElementId: null,
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

  // factory 가 Label 자식에 fontWeight:600 inline 주입하는 부모 컨텍스트들.
  const labelParents = [
    "CheckboxGroup",
    "RadioGroup",
    "TagGroup",
    "Select",
    "ComboBox",
    "TextField",
    "NumberField",
    "SearchField",
    "DateField",
    "ColorField",
  ] as const;

  it.each(labelParents)(
    "%s > Label (factory inline fontWeight:600) 은 dirty=false",
    (parent) => {
      const parentEl = makeTaggedElement("p-1", parent, { size: "md" });
      const labelEl: Element = {
        id: "lbl-1",
        type: "Label",
        parent_id: parentEl.id,
        props: { style: { fontWeight: 600 } },
      } as Element;

      useStore.setState({
        selectedElementId: labelEl.id,
        selectedElementProps: labelEl.props,
        currentPageId: null,
        elements: [parentEl, labelEl],
        elementsMap: new Map([
          [parentEl.id, parentEl],
          [labelEl.id, labelEl],
        ]),
        childrenMap: new Map(),
        dirtyElementIds: new Set(),
        layoutVersion: 0,
      });

      const { result: dirty } = renderHook(() =>
        useHasDirtyStyles(["fontWeight"]),
      );
      expect(
        dirty.current,
        `${parent} > Label fontWeight:600 이 baseline(catalog textWeight 600)과 어긋나 dirty 오판`,
      ).toBe(false);
    },
  );

  it("standalone Label (createDefaultLabelProps fontWeight:600) 도 dirty=false", () => {
    const labelEl: Element = {
      id: "lbl-1",
      type: "Label",
      parent_id: null,
      props: { style: { fontWeight: 600 } },
    } as Element;

    useStore.setState({
      selectedElementId: labelEl.id,
      selectedElementProps: labelEl.props,
      currentPageId: null,
      elements: [labelEl],
      elementsMap: new Map([[labelEl.id, labelEl]]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
    });

    const { result: dirty } = renderHook(() =>
      useHasDirtyStyles(["fontWeight"]),
    );
    expect(dirty.current).toBe(false);
  });
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
