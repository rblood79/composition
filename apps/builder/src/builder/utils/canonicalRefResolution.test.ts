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

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
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
