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
import {
  useHasDirtyStyles,
  useResetStyles,
  computeDirtyStyleProps,
} from "./useResetStyles";
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
 * Heading/Description false dirty 회귀 가드 (2026-06-24 전수조사 정정 — size prop 전환).
 *
 * Heading/Description 은 부모(InlineAlert/Toast/Card/Dialog/Popover)의 자식으로 생성되며 부모마다
 * 의도된 크기가 다르다(Dialog 제목 18 > Card 16 > Toast 14 — catalog size 토큰과 매칭). 과거 factory
 * 가 inline `fontSize:"14/16/18px"` 를 하드코딩해 dirty resolver 가 props.size 를 못 읽고 md(16) 고정
 * baseline 으로 판정 → Toast/Dialog 에서 fontSize false dirty + textWeight 700↔600 비대칭. 정정:
 * (1) factory inline fontSize/lineHeight → `size` prop("sm"/"md"/"lg") 전환 — dirty resolver 가
 * props.size 로 specStyle 을 size 별 계산 → baseline 정합. (2) catalog Heading textWeight 700→600
 * (Toast/Card/Dialog 시각 정본, InlineAlert 는 InlineAlert.sizes.headingFontWeight 별도 경로).
 * (3) Heading fontWeight:600 inline 은 유지 — CSS 가 variant.textWeight(Skia-only 채널)를 emit 안 해
 * DOM <h*> 기본 700 ↔ Skia 600 발산 방지. Description fontWeight 는 DOM 기본 400 = catalog 일치라 inline
 * 불요. 값이 어긋나면(size 누락/inline fontSize 부활/textWeight≠600) 이 audit 이 FAIL.
 */
describe("useResetStyles — Heading/Description size prop false dirty 회귀 가드", () => {
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

  // 각 case: 정정된 factory 의 (size prop + inline style) 미러 — 부모 컨텍스트별.
  const cases = [
    {
      name: "Toast Heading (size=sm + fontWeight 600)",
      type: "Heading",
      size: "sm",
      style: { display: "block", fontWeight: "600" },
      parent: "Toast",
    },
    {
      name: "Card Heading (size=md + fontWeight 600)",
      type: "Heading",
      size: "md",
      style: { display: "block", fontWeight: "600", margin: "0", flex: 1 },
      parent: "Card",
    },
    {
      name: "Dialog Heading (size=lg + fontWeight 600)",
      type: "Heading",
      size: "lg",
      style: { display: "block", fontWeight: "600" },
      parent: "Dialog",
    },
    {
      name: "Toast Description (size=lg, fontWeight inline 없음)",
      type: "Description",
      size: "lg",
      style: { display: "block" },
      parent: "Toast",
    },
    {
      name: "Card Description (size=lg + width)",
      type: "Description",
      size: "lg",
      style: { display: "block", width: "100%", color: "#49454f" },
      parent: "Card",
    },
    {
      name: "Popover Description (size=md)",
      type: "Description",
      size: "md",
      style: { display: "block" },
      parent: "Popover",
    },
  ] as const;

  it.each(cases)(
    "$name 는 size prop baseline 에서 dirty=false",
    ({ type, size, style, parent }) => {
      const parentEl = makeTaggedElement("parent-1", parent, { size: "md" });
      const childEl: Element = {
        id: "child-1",
        type,
        parent_id: parentEl.id,
        props: { size, style },
      } as Element;

      useStore.setState({
        selectedElementId: childEl.id,
        selectedElementProps: childEl.props,
        currentPageId: null,
        elements: [parentEl, childEl],
        elementsMap: new Map([
          [parentEl.id, parentEl],
          [childEl.id, childEl],
        ]),
        childrenMap: new Map(),
        dirtyElementIds: new Set(),
        layoutVersion: 0,
      });

      const { result: dirty } = renderHook(() =>
        useHasDirtyStyles(["fontSize", "fontWeight", "lineHeight"]),
      );
      expect(
        dirty.current,
        `${type}(size=${size}, 부모 ${parent}) factory inline+size 가 baseline 과 어긋나 dirty 로 오판`,
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

/**
 * Appearance select(boxShadow/borderStyle)의 dirty baseline 회귀 가드 (M3/M5).
 *
 * factory 가 boxShadow/borderStyle 를 props.style 에 inline 주입하지 않으므로(legacyStyle
 * fallback=undefined), baseline 하드코딩 기본값(boxShadow="none" / borderStyle="solid")이 없으면
 * 패널에서 default 값(none/solid)을 고를 때마다 영구 dirty 가 된다. catalog appearance preset 을
 * mock({}) 하여 fallback 경로만 격리 검증한다.
 */
describe("useResetStyles — appearance select baseline (M3/M5)", () => {
  const originalState = useStore.getState();

  beforeEach(() => {
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue({});
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

  function selectWithStyle(style: Record<string, unknown>): void {
    const element = makeTaggedElement("tg-appearance", "TagGroup", {
      size: "md",
      style,
    });
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
  }

  it("boxShadow:'none' 은 dirty 가 아니다 (baseline none)", () => {
    selectWithStyle({ boxShadow: "none" });
    const { result } = renderHook(() => useHasDirtyStyles(["boxShadow"]));
    expect(result.current).toBe(false);
  });

  it("실제 그림자 값은 boxShadow dirty 로 전환된다", () => {
    selectWithStyle({ boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" });
    const { result } = renderHook(() => useHasDirtyStyles(["boxShadow"]));
    expect(result.current).toBe(true);
  });

  it("borderStyle:'solid' 은 dirty 가 아니다 (baseline solid)", () => {
    selectWithStyle({ borderStyle: "solid" });
    const { result } = renderHook(() => useHasDirtyStyles(["borderStyle"]));
    expect(result.current).toBe(false);
  });

  it("borderStyle:'dashed' 은 dirty 로 전환된다", () => {
    selectWithStyle({ borderStyle: "dashed" });
    const { result } = renderHook(() => useHasDirtyStyles(["borderStyle"]));
    expect(result.current).toBe(true);
  });

  it("명시적 opacity는 Modified Styles 범위에서 dirty로 전환된다", () => {
    selectWithStyle({ opacity: "0.5" });
    const { result } = renderHook(() => useHasDirtyStyles(["opacity"]));
    expect(result.current).toBe(true);
  });
});

/**
 * 배경(fills)이 dirty 소스에 포함되는지 회귀 가드 (M1).
 *
 * 배경은 fills(canonical 1차 필드)로 이동해 computeDirtyStyleProps 가 props.style 만 보면
 * "배경만 바꾼" 요소의 Appearance reset 버튼이 안 뜬다. fills 를 adapt(color) + 별도 표시
 * (gradient/image)해 dirty 로 잡는다. catalog appearance preset 은 mock({}) 으로 격리.
 */
describe("useResetStyles — fills backgroundColor dirty (M1)", () => {
  const originalState = useStore.getState();

  beforeEach(() => {
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue({});
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

  function selectWithFills(fills: unknown[] | undefined): void {
    const element = {
      id: "tg-fills",
      type: "TagGroup",
      props: { size: "md", style: {} },
      ...(fills ? { fills } : {}),
    } as unknown as Element;
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
  }

  it("color fill 이 있으면 backgroundColor dirty (배경만 변경 → reset 버튼 노출)", () => {
    selectWithFills([{ type: "color", enabled: true, color: "#123456FF" }]);
    const { result } = renderHook(() => useHasDirtyStyles(["backgroundColor"]));
    expect(result.current).toBe(true);
  });

  it("gradient fill 도 backgroundColor dirty (backgroundImage 라 색 미surface)", () => {
    selectWithFills([
      {
        type: "linear-gradient",
        enabled: true,
        stops: [
          { color: "#000000", position: 0 },
          { color: "#FFFFFF", position: 1 },
        ],
      },
    ]);
    const { result } = renderHook(() => useHasDirtyStyles(["backgroundColor"]));
    expect(result.current).toBe(true);
  });

  it("fills 가 없으면 backgroundColor dirty 아님", () => {
    selectWithFills(undefined);
    const { result } = renderHook(() => useHasDirtyStyles(["backgroundColor"]));
    expect(result.current).toBe(false);
  });

  it("빈 fills 배열은 dirty 아님 (무 fill 과 동일 semantics)", () => {
    selectWithFills([]);
    const { result } = renderHook(() => useHasDirtyStyles(["backgroundColor"]));
    expect(result.current).toBe(false);
  });
});

/**
 * ADR-154: non-desktop breakpoint 에서 편집한 responsive override 는 base(props.style)가
 * 아니라 element.responsive.styles.{bp} 에 저장된다. dirty 판정/reset 이 base-only 면
 * 이 override 를 영원히 감지·해제 못 한다(reset 버튼 dim, base 오염). breakpoint tier 의
 * 명시 override 를 dirty 로 감지하고, reset 은 그 breakpoint 의 override 만 clear 해야 한다.
 */
describe("useResetStyles — ADR-154 non-desktop responsive override dirty/reset", () => {
  const originalState = useStore.getState();

  function makeResponsiveElement(): Element {
    return {
      id: "resp-el",
      type: "Frame",
      props: { size: "md", style: { display: "block" } },
      responsive: {
        styles: { rowGap: { mobile: 33 }, columnGap: { mobile: 33 } },
      },
    } as unknown as Element;
  }

  function selectAt(breakpoint: string): void {
    const el = makeResponsiveElement();
    useStore.setState({
      selectedElementId: "resp-el",
      selectedElementProps: el.props,
      currentPageId: null,
      elements: [el],
      elementsMap: new Map([["resp-el", el]]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
      activeBreakpoint: breakpoint,
    } as never);
  }

  beforeEach(() => {
    vi.spyOn(preset, "resolveLayoutSpecPreset").mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(originalState, true);
  });

  it("computeDirtyStyleProps: mobile override 를 dirty 로 감지 (gap/rowGap), 무관 prop 은 제외", () => {
    const el = makeResponsiveElement();
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["gap", "rowGap", "padding"],
      "mobile" as never,
    );
    expect(dirty).toContain("gap");
    expect(dirty).toContain("rowGap");
    expect(dirty).not.toContain("padding");
  });

  it("computeDirtyStyleProps: desktop 은 responsive 무시 (base 기준 dirty 아님)", () => {
    const el = makeResponsiveElement();
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["gap"],
      "desktop" as never,
    );
    expect(dirty).not.toContain("gap");
  });

  it("computeDirtyStyleProps: 다른 tier(tablet) override 는 mobile 에서 dirty 아님 (자기 tier 만)", () => {
    const el = {
      id: "resp-el",
      type: "Frame",
      props: { style: {} },
      responsive: { styles: { rowGap: { tablet: 10 } } },
    } as unknown as Element;
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["gap"],
      "mobile" as never,
    );
    expect(dirty).not.toContain("gap");
  });

  it("useHasDirtyStyles: mobile 에서 responsive override 있으면 reset 버튼 활성(true)", () => {
    selectAt("mobile");
    const { result } = renderHook(() => useHasDirtyStyles(["gap"]));
    expect(result.current).toBe(true);
  });

  it("useHasDirtyStyles: desktop 으로 전환하면 base 기준 dirty=false", () => {
    selectAt("desktop");
    const { result } = renderHook(() => useHasDirtyStyles(["gap"]));
    expect(result.current).toBe(false);
  });

  it("reset: mobile 에서 responsive override 를 clear (base 무변경)", () => {
    selectAt("mobile");
    const { result } = renderHook(() => useResetStyles());
    act(() => {
      result.current(["gap", "rowGap", "columnGap"]);
    });
    const el = useStore.getState().elementsMap.get("resp-el");
    const styles = (el?.responsive?.styles ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    expect(styles.rowGap?.mobile).toBeUndefined();
    expect(styles.columnGap?.mobile).toBeUndefined();
    // base props.style 은 무변경 (전가/오염 없음)
    const baseStyle = el?.props?.style as Record<string, unknown> | undefined;
    expect(baseStyle?.display).toBe("block");
    expect(baseStyle?.rowGap).toBeUndefined();
  });

  // 배경(fills)은 breakpoint 무관 **전역** 채널(node.fills) — write(updateSelectedFills)·
  //   reset(AppearanceSection.handleReset → updateSelectedFills([]))이 모두 전역인데 과거엔
  //   dirty 판정만 desktop 분기에서만 fills 를 adapt 해, non-desktop tier 에서 "배경은 바뀌어
  //   보이는데 reset 버튼이 죽는" 비대칭이 있었다(사용자 보고 2026-07-21). 전역 fills 가 있으면
  //   모든 breakpoint 에서 backgroundColor 를 dirty 로 surface 해 전역 write ↔ 전역 reset 대칭 복원.
  it("computeDirtyStyleProps: mobile 에서도 전역 fills 는 backgroundColor dirty (전역 채널)", () => {
    const el = {
      id: "resp-fills",
      type: "Frame",
      props: { style: {} },
      fills: [{ type: "color", enabled: true, color: "#123456FF" }],
    } as unknown as Element;
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["backgroundColor"],
      "mobile" as never,
    );
    expect(dirty).toContain("backgroundColor");
  });

  it("computeDirtyStyleProps: tablet 에서도 전역 fills 는 backgroundColor dirty", () => {
    const el = {
      id: "resp-fills",
      type: "Frame",
      props: { style: {} },
      fills: [{ type: "color", enabled: true, color: "#abcdefFF" }],
    } as unknown as Element;
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["backgroundColor"],
      "tablet" as never,
    );
    expect(dirty).toContain("backgroundColor");
  });

  it("computeDirtyStyleProps: fills 없으면 mobile 에서 backgroundColor dirty 아님 (BC)", () => {
    const el = {
      id: "resp-nofill",
      type: "Frame",
      props: { style: {} },
    } as unknown as Element;
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["backgroundColor"],
      "mobile" as never,
    );
    expect(dirty).not.toContain("backgroundColor");
  });

  it("useHasDirtyStyles: mobile + 전역 fills 면 Appearance reset 버튼 활성(true)", () => {
    const el = {
      id: "resp-fills",
      type: "Frame",
      props: { size: "md", style: {} },
      fills: [{ type: "color", enabled: true, color: "#123456FF" }],
    } as unknown as Element;
    useStore.setState({
      selectedElementId: "resp-fills",
      selectedElementProps: el.props,
      currentPageId: null,
      elements: [el],
      elementsMap: new Map([["resp-fills", el]]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
      activeBreakpoint: "mobile",
    } as never);
    const { result } = renderHook(() => useHasDirtyStyles(["backgroundColor"]));
    expect(result.current).toBe(true);
  });

  // border(색/스타일/너비)는 전역(base) 속성 — fills 와 동형으로 non-desktop 에서도
  //   base 비교로 dirty 를 surface 해야 reset 버튼이 산다 (2026-07-22).
  it("computeDirtyStyleProps: mobile 에서 base border 는 dirty (전역 속성)", () => {
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue(
      {} as never,
    );
    const el = {
      id: "resp-border",
      type: "Frame",
      props: {
        style: {
          borderColor: "#ff0000",
          borderStyle: "dashed",
          borderWidth: 2,
        },
      },
    } as unknown as Element;
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["borderColor", "borderStyle", "borderWidth"],
      "mobile" as never,
    );
    expect(dirty).toContain("borderColor");
    expect(dirty).toContain("borderStyle");
    expect(dirty).toContain("borderWidth");
  });

  it("computeDirtyStyleProps: base border 없으면 mobile 에서 dirty 아님", () => {
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue(
      {} as never,
    );
    const el = {
      id: "resp-noborder",
      type: "Frame",
      props: { style: {} },
    } as unknown as Element;
    const dirty = computeDirtyStyleProps(
      el,
      undefined,
      ["borderColor", "borderWidth"],
      "mobile" as never,
    );
    expect(dirty).not.toContain("borderColor");
    expect(dirty).not.toContain("borderWidth");
  });
});
