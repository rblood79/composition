import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";
import { buildSpecNodeData } from "./buildSpecNodeData";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type {
  FillItem,
  LinearGradientFillItem,
  MeshGradientFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";

function makeLayout(
  partial: Pick<ComputedLayout, "x" | "y" | "width" | "height">,
): ComputedLayout {
  return partial as ComputedLayout;
}

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Label",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as CanvasSceneNode;
}

function collectText(node: SkiaNodeData | undefined | null): string[] {
  if (!node) return [];
  const own = node.text?.content ? [node.text.content] : [];
  return [
    ...own,
    ...(node.children ?? []).flatMap((child) => collectText(child)),
  ];
}

describe("buildSpecNodeData", () => {
  it("does not render center placeholder text for visible Slot chrome", () => {
    const slot = makeElement("slot-content", {
      type: "Slot",
      props: {
        name: "content",
      },
    });

    const node = buildSpecNodeData({
      element: slot,
      layout: makeLayout({ x: 0, y: 0, width: 240, height: 80 }),
      theme: "light",
      elementsMap: new Map([[slot.id, slot]]),
    });

    expect(node).not.toBeNull();
    expect(node?.box?.strokeColor).toBeDefined();
    expect(collectText(node)).toEqual([]);
  });

  it("hides Slot chrome when page-frame resolution marks it as page content anchor", () => {
    const slot = makeElement("slot-content", {
      type: "Slot",
      props: {
        name: "content",
        _slotChrome: "hidden",
      },
    });

    const node = buildSpecNodeData({
      element: slot,
      layout: makeLayout({ x: 0, y: 0, width: 240, height: 80 }),
      theme: "light",
      elementsMap: new Map([[slot.id, slot]]),
    });

    expect(node).not.toBeNull();
    expect(node?.box?.fillColor?.[3]).toBe(0);
    expect(node?.box?.strokeColor).toBeUndefined();
    expect(collectText(node)).toEqual([]);
  });

  it("uses NumberField parent label for its Label child", () => {
    const parent = makeElement("number", {
      type: "NumberField",
      props: { label: "Edited label" },
    });
    const label = makeElement("label", {
      parent_id: "number",
      props: { children: "Old label" },
    });
    const elementsMap = new Map([
      [parent.id, parent],
      [label.id, label],
    ]);

    const node = buildSpecNodeData({
      element: label,
      layout: makeLayout({ x: 0, y: 0, width: 120, height: 24 }),
      theme: "light",
      elementsMap,
    });

    expect(collectText(node)).toContain("Edited label");
    expect(collectText(node)).not.toContain("Old label");
  });

  it("uses resolved ref parent label for projected NumberField Label children", () => {
    const origin = makeElement("origin", {
      type: "NumberField",
      reusable: true,
      props: { label: "Origin edited" },
    });
    const originLabel = makeElement("origin-label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      props: { children: "Old label" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: {},
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [origin, originLabel, instance],
      elementsMap: new Map([
        [origin.id, origin],
        [originLabel.id, originLabel],
        [instance.id, instance],
      ]),
    });
    const label = tree.elementsMap.get("instance/label");

    const node = buildSpecNodeData({
      element: label!,
      layout: makeLayout({ x: 0, y: 0, width: 120, height: 24 }),
      theme: "light",
      elementsMap: tree.elementsMap,
    });

    expect(collectText(node)).toContain("Origin edited");
    expect(collectText(node)).not.toContain("Old label");
  });

  it("uses resolved ref parent label override for projected SearchField Label children", () => {
    const origin = makeElement("origin", {
      type: "SearchField",
      reusable: true,
      props: { label: "Search" },
    });
    const originLabel = makeElement("origin-label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      props: { children: "Search" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { label: "Find records" },
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [origin, originLabel, instance],
      elementsMap: new Map([
        [origin.id, origin],
        [originLabel.id, originLabel],
        [instance.id, instance],
      ]),
    });
    const label = tree.elementsMap.get("instance/label");

    const node = buildSpecNodeData({
      element: label!,
      layout: makeLayout({ x: 0, y: 0, width: 120, height: 24 }),
      theme: "light",
      elementsMap: tree.elementsMap,
    });

    expect(collectText(node)).toContain("Find records");
    expect(collectText(node)).not.toContain("Search");
  });

  it.each([
    "Select",
    "ComboBox",
    "TagGroup",
    "ProgressBar",
    "Meter",
    "Slider",
    "DateField",
    "TimeField",
    "DatePicker",
    "DateRangePicker",
  ])(
    "uses propagation label override for projected %s Label children",
    (type) => {
      const origin = makeElement("origin", {
        type,
        reusable: true,
        props: { label: "Origin label" },
      });
      const originLabel = makeElement("origin-label", {
        type: "Label",
        customId: "label",
        parent_id: "origin",
        props: { children: "Origin label" },
      });
      const instance = makeElement("instance", {
        type: "ref",
        ref: "origin",
        props: { label: "Instance label" },
      } as never);

      const tree = resolveCanonicalRefTree({
        elements: [origin, originLabel, instance],
        elementsMap: new Map([
          [origin.id, origin],
          [originLabel.id, originLabel],
          [instance.id, instance],
        ]),
      });
      const label = tree.elementsMap.get("instance/label");

      const node = buildSpecNodeData({
        element: label!,
        layout: makeLayout({ x: 0, y: 0, width: 120, height: 24 }),
        theme: "light",
        elementsMap: tree.elementsMap,
      });

      expect(collectText(node)).toContain("Instance label");
      expect(collectText(node)).not.toContain("Origin label");
    },
  );

  it("uses nested parent placeholder override for projected SearchField input", () => {
    const origin = makeElement("origin", {
      type: "SearchField",
      reusable: true,
      props: { placeholder: "Search" },
    });
    const wrapper = makeElement("wrapper", {
      type: "SelectTrigger",
      customId: "wrapper",
      parent_id: "origin",
    });
    const input = makeElement("input", {
      type: "SelectValue",
      customId: "input",
      parent_id: "wrapper",
      props: { placeholder: "Search" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { placeholder: "Find records" },
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [origin, wrapper, input, instance],
      elementsMap: new Map([
        [origin.id, origin],
        [wrapper.id, wrapper],
        [input.id, input],
        [instance.id, instance],
      ]),
    });
    const searchInput = tree.elementsMap.get("instance/wrapper/input");

    const node = buildSpecNodeData({
      element: searchInput!,
      layout: makeLayout({ x: 0, y: 0, width: 160, height: 24 }),
      theme: "light",
      elementsMap: tree.elementsMap,
    });

    expect(collectText(node)).toContain("Find records");
    expect(collectText(node)).not.toContain("Search");
  });

  // 회귀 방지 (2026-06-25): SYNTHETIC 컨테이너(Select/ComboBox)는 자식 SelectValue/ComboBoxInput
  // 이 placeholder 입력 영역을 그리므로, 컨테이너 자신은 shell(box) 만 그려야 한다. shellOnlyProps
  // 가 children/text/label 만 차단하고 placeholder 를 누락하면 buildCatalogShapes `:217 text` 가
  // placeholder 로 fallback 하여 컨테이너 노드에도 placeholder text 가 **이중** 렌더된다.
  it.each(["Select", "ComboBox"])(
    "does not render placeholder text on the %s synthetic container itself (shell-only)",
    (type) => {
      const container = makeElement("container", {
        type,
        props: { placeholder: "Choose an option..." },
      });

      const node = buildSpecNodeData({
        element: container,
        layout: makeLayout({ x: 0, y: 0, width: 200, height: 30 }),
        theme: "light",
        elementsMap: new Map([[container.id, container]]),
      });

      expect(node).not.toBeNull();
      expect(collectText(node)).not.toContain("Choose an option...");
    },
  );

  // 회귀 방지 (2026-06-25): Select/ComboBox 의 SelectIcon 은 factory 에서 iconName 미지정이라
  // 자기/조부모 iconName 이 모두 없으면 resolveIconDelegation 이 chevron-down 을 기본값으로 줘야
  // 한다. null 반환 시 skiaPrimitives.iconFont 의 generic `?? "circle"` fallback 으로 떨어져 Skia 가
  // 동그라미(○)를 그리고, DOM Select(Select.tsx:335 chevron-down 기본값)와 발산한다.
  function findIconPath(
    node: SkiaNodeData | undefined | null,
  ): { paths?: string[]; circles?: unknown[] } | null {
    if (!node) return null;
    const ip = (
      node as { iconPath?: { paths?: string[]; circles?: unknown[] } }
    ).iconPath;
    if (ip) return ip;
    for (const child of node.children ?? []) {
      const r = findIconPath(child);
      if (r) return r;
    }
    return null;
  }

  it.each(["Select", "ComboBox"])(
    "%s SelectIcon without iconName defaults to chevron-down (DOM parity, not circle)",
    (containerType) => {
      const container = makeElement("c", { type: containerType });
      const trigger = makeElement("t", {
        type: "SelectTrigger",
        parent_id: "c",
      });
      const icon = makeElement("i", {
        type: "SelectIcon",
        parent_id: "t",
        props: { style: { width: 18, height: 18 } },
      });
      const node = buildSpecNodeData({
        element: icon,
        layout: makeLayout({ x: 0, y: 0, width: 18, height: 18 }),
        theme: "light",
        elementsMap: new Map([
          [container.id, container],
          [trigger.id, trigger],
          [icon.id, icon],
        ]),
      });

      const ip = findIconPath(node);
      // chevron-down Lucide glyph path
      expect(ip?.paths).toContain("m6 9 6 6 6-6");
      // generic "circle" fallback 회귀 방지
      expect(ip?.circles ?? []).toHaveLength(0);
    },
  );

  it("explicit SelectIcon iconName wins over chevron-down default", () => {
    const container = makeElement("c", { type: "Select" });
    const trigger = makeElement("t", { type: "SelectTrigger", parent_id: "c" });
    const icon = makeElement("i", {
      type: "SelectIcon",
      parent_id: "t",
      props: { iconName: "star", style: { width: 18, height: 18 } },
    });
    const node = buildSpecNodeData({
      element: icon,
      layout: makeLayout({ x: 0, y: 0, width: 18, height: 18 }),
      theme: "light",
      elementsMap: new Map([
        [container.id, container],
        [trigger.id, trigger],
        [icon.id, icon],
      ]),
    });

    const ip = findIconPath(node);
    expect(ip?.paths).not.toContain("m6 9 6 6 6-6");
  });

  it("does not throw when parent links contain a cycle", () => {
    const tagGroup = makeElement("tag-group", {
      type: "TagGroup",
      parent_id: "tag-list",
      props: {
        items: [{ id: "one", label: "One" }],
        maxRows: 1,
      },
    });
    const tagList = makeElement("tag-list", {
      type: "TagList",
      parent_id: "tag-group",
      props: {},
    });
    const elementsMap = new Map([
      [tagGroup.id, tagGroup],
      [tagList.id, tagList],
    ]);

    expect(() =>
      buildSpecNodeData({
        element: tagList,
        layout: makeLayout({ x: 0, y: 0, width: 160, height: 32 }),
        theme: "light",
        elementsMap,
      }),
    ).not.toThrow();
  });

  // ── RadioGroup value → 자식 Radio Skia isSelected 주입 (2026-06-30) ──
  // Why: RadioGroup selection SSOT 는 그룹 value(RAC 모델). 패널에서 value 만 바꾸면 자식
  //   Radio.isSelected 는 그대로(undefined) → Skia radio primitive(props.isSelected 직접 읽음)
  //   미반영 → CSS preview(RAC value 매칭) 와 drift. buildSpecNodeData 가 부모 RadioGroup value
  //   ↔ 자식 value 매칭으로 isSelected 를 주입(Tabs selectedKey→Tab._isSelected 동형)해야 한다.
  //   검증: radio indicator 는 children box 노드로 변환됨 — selected = ring(borderRadius:10)
  //   + dot(8x8 borderRadius:4) 2개 child, 미선택 = ring 1개 child. child 개수로 판정.
  describe("RadioGroup value → 자식 Radio isSelected 주입", () => {
    function countCircles(node: SkiaNodeData | undefined | null): number {
      if (!node) return 0;
      return node.children?.length ?? 0;
    }

    function buildRadio(
      groupValue: string | undefined,
      radioValue: string,
      ownIsSelected?: boolean,
    ): SkiaNodeData | null {
      const group = makeElement("rg", {
        type: "RadioGroup",
        props: groupValue !== undefined ? { value: groupValue } : {},
      });
      const radio = makeElement("r1", {
        type: "Radio",
        parent_id: "rg",
        props: {
          value: radioValue,
          ...(ownIsSelected !== undefined ? { isSelected: ownIsSelected } : {}),
        },
      });
      const elementsMap = new Map([
        [group.id, group],
        [radio.id, radio],
      ]);
      return buildSpecNodeData({
        element: radio,
        layout: makeLayout({ x: 0, y: 0, width: 20, height: 20 }),
        theme: "light",
        elementsMap,
      });
    }

    it("group value 가 자식 value 와 매칭되면 selected (dot circle 추가)", () => {
      const selected = buildRadio("a", "a");
      const unselected = buildRadio("a", "b");
      // selected radio: ring + dot = circle 2개 / 미선택: ring 만 = 1개.
      expect(countCircles(selected)).toBeGreaterThan(countCircles(unselected));
    });

    it("group value 미설정이면 자식 자신의 isSelected 보존 (부모-주도 미적용)", () => {
      // value 미설정 → 자식 isSelected=true 면 selected, false 면 미선택.
      const ownSelected = buildRadio(undefined, "a", true);
      const ownUnselected = buildRadio(undefined, "a", false);
      expect(countCircles(ownSelected)).toBeGreaterThan(
        countCircles(ownUnselected),
      );
    });

    it("group value 가 빈 문자열이면 자식 isSelected 보존 (value 미설정과 동일)", () => {
      const ownSelected = buildRadio("", "a", true);
      const ownUnselected = buildRadio("", "a", false);
      expect(countCircles(ownSelected)).toBeGreaterThan(
        countCircles(ownUnselected),
      );
    });

    it("group value 매칭이 자식 자신의 isSelected=false 를 이긴다 (그룹 SSOT)", () => {
      // 자식 isSelected=false 여도 group value 매칭이면 selected (RAC value 우선).
      const groupWins = buildRadio("a", "a", false);
      const groupUnmatch = buildRadio("a", "b", true);
      // 매칭 radio 는 selected(dot), 미매칭 radio 는 자기 isSelected=true 무시하고 미선택.
      expect(countCircles(groupWins)).toBeGreaterThan(
        countCircles(groupUnmatch),
      );
    });
  });

  // 회귀 방지 (2026-07-14, 사용자 적발): DatePicker 의 size 를 바꿔도 Skia SelectIcon 이
  //   그대로였다. 자식 store 에 남은 **stale size**(예 "md")가 `props.size ?? delegated` 의
  //   앞자리를 차지해 부모(xl)를 영원히 가렸기 때문. `override: true` propagation rule 이 준
  //   size 는 **자식 자신의 props.size 를 이겨야** 한다(resolveOverriddenPropagatedSize).
  //
  //   `resolveParentDelegatedSize` 로는 못 고친다 — reverse index 가 **평면 childPath 만**
  //   등록하고 중첩 경로(["SelectTrigger","SelectIcon"])는 제외하며, 애초에 props.size 뒤의
  //   fallback 이라 stale 값을 못 이긴다.
  describe("SelectIcon size — override propagation 이 자식 stale size 를 이긴다", () => {
    function iconGlyphSize(
      parentSize: string,
      childStaleSize?: string,
    ): number | null {
      const picker = makeElement("dp", {
        type: "DatePicker",
        props: { size: parentSize, iconName: "calendar" },
      });
      const trigger = makeElement("tr", {
        type: "SelectTrigger",
        parent_id: "dp",
      });
      const icon = makeElement("ic", {
        type: "SelectIcon",
        parent_id: "tr",
        props: childStaleSize ? { size: childStaleSize } : {},
      });
      const node = buildSpecNodeData({
        element: icon,
        layout: makeLayout({ x: 0, y: 0, width: 28, height: 28 }),
        theme: "light",
        elementsMap: new Map([
          [picker.id, picker],
          [trigger.id, trigger],
          [icon.id, icon],
        ]),
      });
      const found = findIconPath(node) as { size?: number } | null;
      return found?.size ?? null;
    }

    // glyph 크기는 catalog `sizes[*].fontSize`(typography 토큰) 파생 — md=16 / lg=18 / xl=20.
    //   (박스 크기 `iconSize` 18/22/28 과는 다른 축. 여기서 검증하는 건 **부모를 따라가는가**.)
    const MD = iconGlyphSize("md");
    const XL = iconGlyphSize("xl");

    it("부모 size 가 다르면 아이콘 glyph 도 다르다 (전제 — 크기 축이 살아있음)", () => {
      expect(MD).not.toBeNull();
      expect(XL).not.toBeNull();
      expect(XL).toBeGreaterThan(MD as number);
    });

    it("자식에 stale size('md') 가 남아 있어도 부모(xl) 가 이긴다 (핵심 회귀)", () => {
      // 수정 전: 자식의 stale "md" 가 `props.size ?? delegated` 앞자리를 차지해 부모를 가렸다.
      expect(iconGlyphSize("xl", "md")).toBe(XL);
    });

    it("자식 stale size 가 있어도 부모 size 변경이 그대로 반영된다", () => {
      expect(iconGlyphSize("md", "md")).toBe(MD);
      expect(iconGlyphSize("xl", "md")).toBe(XL);
      // 부모만 바꿨는데 glyph 가 따라 변한다 = size 변경 반영됨
      expect(iconGlyphSize("xl", "md")).not.toBe(iconGlyphSize("md", "md"));
    });
  });

  // 회귀 방지 (boxShadow Skia 배선 복원): spec/catalog 경로가 style.boxShadow 를
  //   buildSkiaEffects 로 공급하지 않아 캔버스에서 그림자가 무반응이었다. box 경로
  //   (buildBoxNodeData:68) 와 동일 파서로 drop-shadow effect 를 node.effects 에 접붙인다.
  describe("CSS effects → node.effects (boxShadow / filter / opacity)", () => {
    function buildWithStyle(
      style: Record<string, unknown>,
      componentState?: string,
    ): SkiaNodeData | null {
      const el = makeElement("btn", {
        type: "Button",
        props: {
          children: "Go",
          ...(componentState ? { isDisabled: true } : {}),
          style,
        },
      });
      return buildSpecNodeData({
        element: el,
        layout: makeLayout({ x: 0, y: 0, width: 200, height: 40 }),
        theme: "light",
        elementsMap: new Map([[el.id, el]]),
      });
    }

    it("style.boxShadow → drop-shadow effect 접붙임", () => {
      const node = buildWithStyle({
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      });
      expect(node?.effects?.some((e) => e.type === "drop-shadow")).toBe(true);
    });

    it("다중 boxShadow → drop-shadow effect 2개", () => {
      const node = buildWithStyle({
        boxShadow: "0 1px 2px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)",
      });
      const shadows = node?.effects?.filter((e) => e.type === "drop-shadow");
      expect(shadows?.length).toBe(2);
    });

    it("boxShadow 없으면 drop-shadow effect 없음", () => {
      const node = buildWithStyle({});
      expect(node?.effects?.some((e) => e.type === "drop-shadow")).not.toBe(
        true,
      );
    });

    it("style.opacity<1 → opacity effect 접붙임", () => {
      const node = buildWithStyle({ opacity: 0.5 });
      expect(node?.effects?.some((e) => e.type === "opacity")).toBe(true);
    });

    it("style.filter: blur() → layer-blur effect 접붙임", () => {
      const node = buildWithStyle({ filter: "blur(4px)" });
      expect(node?.effects?.some((e) => e.type === "layer-blur")).toBe(true);
    });
  });

  // 회귀 방지 (overflow 클리핑 Skia 배선 복원): spec/catalog 경로가 node-level clipChildren 을
  //   설정하지 않아 overflow:hidden 컨테이너의 요소 자식이 캔버스에서 넘쳐 보였다. box 경로
  //   (buildBoxNodeData:169-173)와 동일 계약으로 overflow hidden/clip/scroll/auto 에서 clipChildren=true.
  describe("overflow → node.clipChildren (컨테이너 자식 클리핑)", () => {
    function clipChildrenFor(overflow?: string): boolean | undefined {
      const el = makeElement("card", {
        type: "Card",
        props: {
          ...(overflow ? { style: { overflow } } : {}),
        },
      });
      const node = buildSpecNodeData({
        element: el,
        layout: makeLayout({ x: 0, y: 0, width: 200, height: 120 }),
        theme: "light",
        elementsMap: new Map([[el.id, el]]),
      });
      return node?.clipChildren;
    }

    it.each(["hidden", "clip", "scroll", "auto"])(
      "overflow:%s → clipChildren=true",
      (overflow) => {
        expect(clipChildrenFor(overflow)).toBe(true);
      },
    );

    it("overflow:visible → clipChildren 미설정", () => {
      expect(clipChildrenFor("visible")).not.toBe(true);
    });

    it("overflow 미지정 → clipChildren 미설정", () => {
      expect(clipChildrenFor()).not.toBe(true);
    });
  });

  // 회귀 방지 (overflow 스크롤 Skia 배선 복원): spec/catalog 경로가 scrollState 를 받지
  //   못해 scrollOffset/scrollbar 를 산출하지 않았다 (sprite 시대 배선이 bridge 이관 때 탈락).
  //   box 경로(buildBoxNodeData:175-204)와 동일 계약으로 scrollOffset/scrollbar 를 산출한다.
  describe("overflow:scroll + scrollState → scrollOffset / scrollbar", () => {
    function buildScroll(
      overflow: string,
      scrollState?: {
        scrollTop: number;
        scrollLeft: number;
        maxScrollTop: number;
        maxScrollLeft: number;
      } | null,
    ): SkiaNodeData | null {
      const el = makeElement("card", {
        type: "Card",
        props: { style: { overflow } },
      });
      return buildSpecNodeData({
        element: el,
        layout: makeLayout({ x: 0, y: 0, width: 200, height: 120 }),
        theme: "light",
        elementsMap: new Map([[el.id, el]]),
        scrollState,
      });
    }

    it("overflow:scroll + scrollState → scrollOffset 반영 + 수직 scrollbar", () => {
      const node = buildScroll("scroll", {
        scrollTop: 30,
        scrollLeft: 0,
        maxScrollTop: 100,
        maxScrollLeft: 0,
      });
      expect(node?.scrollOffset).toEqual({ scrollTop: 30, scrollLeft: 0 });
      expect(node?.scrollbar?.vertical).toBeDefined();
      expect(node?.scrollbar?.horizontal).toBeUndefined();
    });

    it("overflow:auto + 수평 scroll → 수평 scrollbar", () => {
      const node = buildScroll("auto", {
        scrollTop: 0,
        scrollLeft: 40,
        maxScrollTop: 0,
        maxScrollLeft: 80,
      });
      expect(node?.scrollOffset).toEqual({ scrollTop: 0, scrollLeft: 40 });
      expect(node?.scrollbar?.horizontal).toBeDefined();
      expect(node?.scrollbar?.vertical).toBeUndefined();
    });

    it("scrollState 없으면 scrollOffset 미설정", () => {
      const node = buildScroll("scroll", null);
      expect(node?.scrollOffset).toBeUndefined();
      expect(node?.scrollbar).toBeUndefined();
    });

    it("overflow:hidden 은 scrollState 있어도 scrollOffset 미설정 (scroll/auto 만)", () => {
      const node = buildScroll("hidden", {
        scrollTop: 30,
        scrollLeft: 0,
        maxScrollTop: 100,
        maxScrollLeft: 0,
      });
      expect(node?.scrollOffset).toBeUndefined();
      // 단, hidden 은 여전히 clipChildren 은 true (Phase 2)
      expect(node?.clipChildren).toBe(true);
    });

    it("maxScroll 0 이면 해당 축 scrollbar 없음 (thumb 불필요)", () => {
      const node = buildScroll("scroll", {
        scrollTop: 0,
        scrollLeft: 0,
        maxScrollTop: 0,
        maxScrollLeft: 0,
      });
      // scrollOffset 은 설정되나 scrollbar 는 없음
      expect(node?.scrollOffset).toEqual({ scrollTop: 0, scrollLeft: 0 });
      expect(node?.scrollbar).toBeUndefined();
    });
  });

  describe("Background fills → bg box FillStyle (gradient/mesh)", () => {
    const LINEAR: LinearGradientFillItem = {
      id: "lg1",
      type: FillType.LinearGradient,
      enabled: true,
      opacity: 1,
      blendMode: "normal",
      rotation: 90,
      stops: [
        { color: "#FF0000FF", position: 0 },
        { color: "#0000FFFF", position: 1 },
      ],
    };

    const MESH: MeshGradientFillItem = {
      id: "mg1",
      type: FillType.MeshGradient,
      enabled: true,
      opacity: 1,
      blendMode: "normal",
      rows: 2,
      columns: 2,
      points: [
        { position: [0, 0], color: "#00FF00FF" },
        { position: [1, 0], color: "#0000FFFF" },
        { position: [0, 1], color: "#FF0000FF" },
        { position: [1, 1], color: "#FFFFFFFF" },
      ],
    };

    function buildWithFills(fills: FillItem[]): SkiaNodeData | null {
      const button = makeElement("btn", {
        type: "Button",
        props: { children: "Go" },
        fills,
      });
      return buildSpecNodeData({
        element: button,
        layout: makeLayout({ x: 0, y: 0, width: 200, height: 40 }),
        theme: "light",
        elementsMap: new Map([[button.id, button]]),
      });
    }

    it("linear gradient fill → 최상위 box 에 linear-gradient FillStyle 접붙임", () => {
      const node = buildWithFills([LINEAR]);
      expect(node?.box?.fill?.type).toBe("linear-gradient");
    });

    it("mesh gradient fill → mesh-gradient FillStyle 접붙임", () => {
      const node = buildWithFills([MESH]);
      expect(node?.box?.fill?.type).toBe("mesh-gradient");
    });

    it("gradient fill 의 fallback fillColor 는 첫 stop 색 (shader 실패 대비)", () => {
      const node = buildWithFills([LINEAR]);
      // fillsToSkiaFallbackColor 가 hex6 "#FF0000" 로 주입 → bg box fillColor 적색
      expect(node?.box?.fillColor?.[0]).toBeCloseTo(1, 2);
      expect(node?.box?.fillColor?.[1]).toBeCloseTo(0, 2);
      expect(node?.box?.fillColor?.[2]).toBeCloseTo(0, 2);
    });

    it("color fill 만 있으면 FillStyle 접붙임 없음 (기존 hex6 채널 유지)", () => {
      const colorFill: FillItem = {
        id: "c1",
        type: FillType.Color,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        color: "#123456FF",
      };
      const node = buildWithFills([colorFill]);
      expect(node?.box?.fill).toBeUndefined();
    });
  });
});
