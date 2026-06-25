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
});
