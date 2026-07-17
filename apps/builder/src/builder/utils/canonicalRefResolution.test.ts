import { describe, expect, it } from "vitest";
import type { Element } from "../../types/core/store.types";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import {
  isCanonicalRefElement,
  resolveCanonicalRefMaster,
  resolveCanonicalRefElement,
  resolveCanonicalRefElementsMap,
  resolveCanonicalRefTree,
} from "./canonicalRefResolution";

type LegacyOverrides = Omit<Partial<Element>, "fills"> & {
  order_num?: number;
  reusable?: boolean;
  ref?: string;
  componentRole?: string;
  layout_id?: string | null;
  layoutId?: string | null;
  slot_name?: string | null;
  placeholder?: boolean;
  schemaVersion?: string;
  descendants?: Record<string, unknown>;
  fills?: unknown[];
};

function makeElement(id: string, overrides: LegacyOverrides = {}): Element {
  return {
    id,
    type: "Text",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("canonicalRefResolution", () => {
  it("resolves a canonical ref root as the origin type with merged props", () => {
    const origin = makeElement("origin", {
      type: "Text",
      reusable: true,
      fills: [{ id: "fill-1", type: "solid", color: "#ff0000" }],
      props: {
        text: "Origin text",
        style: { color: "red", left: "10px", top: "20px" },
      },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
      parent_id: "body",
      fills: [{ id: "fill-2", type: "solid", color: "#0000ff" }],
      props: { style: { left: "30px" } },
    } as never);

    const resolved = resolveCanonicalRefElement(ref, [origin, ref]);

    expect(isCanonicalRefElement(ref)).toBe(true);
    expect(resolved).toMatchObject({
      id: "instance",
      type: "Text",
      parent_id: "body",
      props: {
        text: "Origin text",
        style: { color: "red", left: "30px", top: "20px" },
      },
      ref: "origin",
      fills: [{ id: "fill-2", type: "solid", color: "#0000ff" }],
      reusable: undefined,
    });
  });

  it("resolves refs inside an elements map while preserving ids", () => {
    const origin = makeElement("origin", {
      type: "Text",
      reusable: true,
      props: { text: "Origin text" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
    } as never);

    const resolvedMap = resolveCanonicalRefElementsMap(
      new Map([
        ["origin", origin],
        ["instance", ref],
      ]),
    );

    expect(resolvedMap.get("origin")).toBe(origin);
    expect(resolvedMap.get("instance")).toMatchObject({
      id: "instance",
      type: "Text",
      ref: "origin",
      props: { text: "Origin text" },
    });
  });

  it("resolves exported canonical ref mirrors that only carry masterId", () => {
    const origin = makeElement("origin", {
      type: "Text",
      reusable: true,
      props: { text: "Origin text" },
    });
    const ref = withComponentInstanceMirror(
      makeElement("instance", {
        type: "ref",
        props: { style: { left: "12px" } },
      } as never),
      "origin",
    );

    const tree = resolveCanonicalRefTree({
      elements: [origin, ref],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", ref],
      ]),
    });

    expect(isCanonicalRefElement(ref)).toBe(true);
    expect(tree.elementsMap.get("instance")).toMatchObject({
      id: "instance",
      type: "Text",
      ref: "origin",
      props: { text: "Origin text", style: { left: "12px" } },
    });
  });

  it("resolves a canonical ref master by metadata componentName alias", () => {
    const origin = makeElement("origin", {
      type: "Button",
      reusable: true,
      metadata: {
        componentName: "PrimaryAction",
        type: "legacy-element-props",
      },
    } as Partial<Element>);

    expect(resolveCanonicalRefMaster("PrimaryAction", [origin])).toBe(origin);
  });

  it("replicates component descendants under a canonical ref instance", () => {
    const origin = makeElement("origin", {
      type: "TextField",
      reusable: true,
      props: { label: "Name" },
    });
    const label = makeElement("label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      props: { text: "Name" },
    });
    const input = makeElement("input", {
      type: "Input",
      customId: "input",
      parent_id: "origin",
      props: { value: "" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
      descendants: {
        label: { text: "Email" },
      },
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [origin, label, input, ref],
      elementsMap: new Map([
        ["origin", origin],
        ["label", label],
        ["input", input],
        ["instance", ref],
      ]),
    });

    expect(tree.elementsMap.get("instance")).toMatchObject({
      id: "instance",
      type: "TextField",
    });
    expect(tree.childrenMap.get("instance")).toEqual([
      expect.objectContaining({
        id: "instance/label",
        type: "Label",
        parent_id: "instance",
        props: { text: "Email" },
      }),
      expect.objectContaining({
        id: "instance/input",
        type: "Input",
        parent_id: "instance",
        props: { value: "" },
      }),
    ]);
    expect(tree.elementsMap.get("instance/label")).toMatchObject({
      props: { text: "Email" },
    });
  });

  it("materializes ref descendants in source order instead of legacy order_num", () => {
    const origin = makeElement("origin", {
      type: "TextField",
      reusable: true,
    });
    const input = makeElement("input", {
      type: "Input",
      customId: "input",
      parent_id: "origin",
      order_num: 10,
    });
    const label = makeElement("label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      order_num: 0,
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [origin, input, label, ref],
      elementsMap: new Map([
        ["origin", origin],
        ["input", input],
        ["label", label],
        ["instance", ref],
      ]),
    });

    expect(
      tree.childrenMap.get("instance")?.map((element) => element.id),
    ).toEqual(["instance/input", "instance/label"]);
  });

  it("does not duplicate synthetic descendants that already exist as legacy mirrors", () => {
    const origin = makeElement("origin", {
      type: "TextField",
      reusable: true,
      props: { label: "Name" },
    });
    const label = makeElement("label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      props: { text: "Name" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
    } as never);
    const legacyMirror = makeElement("instance/label", {
      type: "Label",
      parent_id: "instance",
      props: { text: "Persisted mirror" },
    });

    const tree = resolveCanonicalRefTree({
      elements: [origin, label, ref, legacyMirror],
      elementsMap: new Map([
        ["origin", origin],
        ["label", label],
        ["instance", ref],
        ["instance/label", legacyMirror],
      ]),
    });

    expect(
      tree.elements.filter((element) => element.id === "instance/label"),
    ).toHaveLength(1);
    expect(tree.childrenMap.get("instance")).toEqual([
      expect.objectContaining({
        id: "instance/label",
        props: { text: "Persisted mirror" },
      }),
    ]);
  });

  it("applies descendant patches to pre-materialized synthetic children after refresh", () => {
    const origin = makeElement("origin", {
      type: "TextField",
      reusable: true,
      props: { label: "Name" },
    });
    const label = makeElement("label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      props: { text: "Name" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
      descendants: {
        label: { text: "Email" },
      },
    } as never);
    const preMaterializedLabel = makeElement("instance/label", {
      type: "Label",
      parent_id: "instance",
      props: { text: "Name" },
    });

    const tree = resolveCanonicalRefTree({
      elements: [origin, label, ref, preMaterializedLabel],
      elementsMap: new Map([
        ["origin", origin],
        ["label", label],
        ["instance", ref],
        ["instance/label", preMaterializedLabel],
      ]),
    });

    expect(tree.elementsMap.get("instance/label")).toMatchObject({
      id: "instance/label",
      props: { text: "Email" },
    });
    expect(tree.childrenMap.get("instance")).toEqual([
      expect.objectContaining({
        id: "instance/label",
        props: { text: "Email" },
      }),
    ]);
  });

  it("materializes mode C children replacement under a synthetic slot host", () => {
    const origin = makeElement("card", {
      type: "Card",
      reusable: true,
    });
    const content = makeElement("content", {
      type: "CardContent",
      customId: "content",
      parent_id: "card",
      slot: [],
    });
    const placeholder = makeElement("placeholder", {
      type: "Text",
      customId: "placeholder",
      parent_id: "content",
      props: { text: "Default body" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "card",
      descendants: {
        content: {
          children: [
            {
              id: "custom-body",
              type: "Text",
              props: { text: "Custom body" },
            },
          ],
        },
      },
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [origin, content, placeholder, ref],
      elementsMap: new Map([
        ["card", origin],
        ["content", content],
        ["placeholder", placeholder],
        ["instance", ref],
      ]),
    });

    expect(tree.childrenMap.get("instance")).toEqual([
      expect.objectContaining({
        id: "instance/content",
        type: "CardContent",
        slot: [],
      }),
    ]);
    expect(tree.childrenMap.get("instance/content")).toEqual([
      expect.objectContaining({
        id: "instance/content/custom-body",
        type: "Text",
        props: { text: "Custom body" },
      }),
    ]);
    expect(tree.elementsMap.has("instance/content/placeholder")).toBe(false);
  });

  it("prunes pre-materialized origin children when mode C replacement is applied after refresh", () => {
    const origin = makeElement("card", {
      type: "Card",
      reusable: true,
    });
    const content = makeElement("content", {
      type: "CardContent",
      customId: "content",
      parent_id: "card",
      slot: [],
    });
    const placeholder = makeElement("placeholder", {
      type: "Text",
      customId: "placeholder",
      parent_id: "content",
      props: { text: "Default body" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "card",
      descendants: {
        content: {
          children: [
            {
              id: "custom-body",
              type: "Text",
              props: { text: "Custom body" },
            },
          ],
        },
      },
    } as never);
    const preMaterializedContent = makeElement("instance/content", {
      type: "CardContent",
      parent_id: "instance",
      slot: [],
    });
    const preMaterializedPlaceholder = makeElement(
      "instance/content/placeholder",
      {
        type: "Text",
        parent_id: "instance/content",
        props: { text: "Default body" },
      },
    );

    const tree = resolveCanonicalRefTree({
      elements: [
        origin,
        content,
        placeholder,
        ref,
        preMaterializedContent,
        preMaterializedPlaceholder,
      ],
      elementsMap: new Map([
        ["card", origin],
        ["content", content],
        ["placeholder", placeholder],
        ["instance", ref],
        ["instance/content", preMaterializedContent],
        ["instance/content/placeholder", preMaterializedPlaceholder],
      ]),
    });

    expect(tree.elementsMap.has("instance/content/placeholder")).toBe(false);
    expect(
      tree.elements.some(
        (element) => element.id === "instance/content/placeholder",
      ),
    ).toBe(false);
    expect(tree.childrenMap.get("instance/content")).toEqual([
      expect.objectContaining({
        id: "instance/content/custom-body",
        props: { text: "Custom body" },
      }),
    ]);
  });

  it("resolves ref children inserted through a mode C slot replacement", () => {
    const card = makeElement("card", {
      type: "Card",
      reusable: true,
    });
    const content = makeElement("content", {
      type: "CardContent",
      customId: "content",
      parent_id: "card",
      slot: ["button"],
    });
    const button = makeElement("button", {
      type: "Button",
      reusable: true,
      props: { label: "Default" },
    });
    const label = makeElement("button-label", {
      type: "Label",
      customId: "label",
      parent_id: "button",
      props: { text: "Default" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "card",
      descendants: {
        content: {
          children: [
            {
              id: "action",
              type: "ref",
              ref: "button",
            },
          ],
        },
      },
    } as never);

    const tree = resolveCanonicalRefTree({
      elements: [card, content, button, label, ref],
      elementsMap: new Map([
        ["card", card],
        ["content", content],
        ["button", button],
        ["button-label", label],
        ["instance", ref],
      ]),
    });

    expect(tree.childrenMap.get("instance/content")).toEqual([
      expect.objectContaining({
        id: "instance/content/action",
        type: "Button",
        ref: "button",
      }),
    ]);
    expect(tree.childrenMap.get("instance/content/action")).toEqual([
      expect.objectContaining({
        id: "instance/content/action/label",
        type: "Label",
        props: { text: "Default" },
      }),
    ]);
  });
});

describe("ADR-148 Phase 2 — 템플릿 바인딩 `{키}` 치환 (propsSchema gate)", () => {
  function makeIconButtonTree(instanceOverrides: LegacyOverrides = {}) {
    const origin = makeElement("component-iconbutton", {
      type: "Button",
      reusable: true,
      props: { variant: "primary", size: "md" },
      metadata: {
        propsSchema: {
          label: { kind: "string", label: "Label", default: "Button" },
          icon: { kind: "icon", label: "Icon", default: "star" },
        },
      },
    } as never);
    const iconChild = makeElement("component-iconbutton__icon", {
      type: "Icon",
      parent_id: "component-iconbutton",
      name: "Icon",
      props: { iconName: "{icon}" },
    } as never);
    const labelChild = makeElement("component-iconbutton__label", {
      type: "Text",
      parent_id: "component-iconbutton",
      name: "Label",
      props: { children: "{label}" },
    } as never);
    const instance = makeElement("instance", {
      type: "ref",
      ref: "component-iconbutton",
      parent_id: "body",
      ...instanceOverrides,
    } as never);
    const elements = [origin, iconChild, labelChild, instance];
    return resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });
  }

  it("instance root override 가 synthetic 자식 placeholder 에 치환된다", () => {
    const tree = makeIconButtonTree({
      props: { label: "Save", icon: "check" },
    });
    expect(tree.elementsMap.get("instance/Label")?.props).toMatchObject({
      children: "Save",
    });
    expect(tree.elementsMap.get("instance/Icon")?.props).toMatchObject({
      iconName: "check",
    });
  });

  it("override 없는 키는 propsSchema default 로 치환된다", () => {
    const tree = makeIconButtonTree();
    expect(tree.elementsMap.get("instance/Label")?.props).toMatchObject({
      children: "Button",
    });
    expect(tree.elementsMap.get("instance/Icon")?.props).toMatchObject({
      iconName: "star",
    });
  });

  it("descendants patch 가 placeholder 를 literal 로 대체하면 그 값을 보존한다", () => {
    const tree = makeIconButtonTree({
      props: { label: "Save" },
      descendants: { Label: { children: "Custom" } },
    });
    expect(tree.elementsMap.get("instance/Label")?.props).toMatchObject({
      children: "Custom",
    });
  });

  it("nested children 축 — resolved root 가 물려받는 origin children 도 치환된다 (Preview consumer)", () => {
    const origin = makeElement("component-iconbutton", {
      type: "Button",
      reusable: true,
      props: { variant: "primary" },
      metadata: {
        propsSchema: {
          label: { kind: "string", label: "Label", default: "Button" },
        },
      },
      children: [
        {
          id: "component-iconbutton__label",
          type: "Text",
          props: { children: "{label}" },
        },
      ],
    } as never);
    const instance = makeElement("instance", {
      type: "ref",
      ref: "component-iconbutton",
      props: { label: "Save" },
    } as never);

    const resolved = resolveCanonicalRefElement(instance, [origin, instance]);
    const children = (resolved as { children?: Array<{ props?: unknown }> })
      .children;
    expect(children?.[0]?.props).toMatchObject({ children: "Save" });
    // origin 자체의 children 은 불변 (참조 공유 오염 금지)
    const originChildren = (origin as { children?: Array<{ props?: unknown }> })
      .children;
    expect(originChildren?.[0]?.props).toMatchObject({ children: "{label}" });
  });

  it("propsSchema 미선언 origin 의 placeholder 는 원형 보존된다 (row-data 바인딩 공존)", () => {
    const origin = makeElement("component-listbox-item-default", {
      type: "ListBoxItem",
      reusable: true,
      props: {},
    });
    const labelChild = makeElement("component-listbox-item-default__label", {
      type: "Text",
      parent_id: "component-listbox-item-default",
      name: "Label",
      props: { children: "{label}" },
    } as never);
    // instance root 에 우연히 동명 키(label)가 있어도 schema gate 가 없으므로 오염 금지.
    const instance = makeElement("row", {
      type: "ref",
      ref: "component-listbox-item-default",
      props: { label: "오염 후보" },
    } as never);
    const elements = [origin, labelChild, instance];
    const tree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });
    expect(tree.elementsMap.get("row/Label")?.props).toMatchObject({
      children: "{label}",
    });
  });
});
