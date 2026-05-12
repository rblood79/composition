import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";
import { buildSpecNodeData } from "./buildSpecNodeData";
import type { SkiaNodeData } from "./nodeRendererTypes";

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
      layout: { x: 0, y: 0, width: 240, height: 80 },
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
      layout: { x: 0, y: 0, width: 240, height: 80 },
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
      layout: { x: 0, y: 0, width: 120, height: 24 },
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
      layout: { x: 0, y: 0, width: 120, height: 24 },
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
      layout: { x: 0, y: 0, width: 120, height: 24 },
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
        layout: { x: 0, y: 0, width: 120, height: 24 },
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
      type: "SearchFieldWrapper",
      customId: "wrapper",
      parent_id: "origin",
    });
    const input = makeElement("input", {
      type: "SearchInput",
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
      layout: { x: 0, y: 0, width: 160, height: 24 },
      theme: "light",
      elementsMap: tree.elementsMap,
    });

    expect(collectText(node)).toContain("Find records");
    expect(collectText(node)).not.toContain("Search");
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
        layout: { x: 0, y: 0, width: 160, height: 32 },
        theme: "light",
        elementsMap,
      }),
    ).not.toThrow();
  });
});
