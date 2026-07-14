import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";
import { buildSpecNodeData } from "./buildSpecNodeData";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

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
});
