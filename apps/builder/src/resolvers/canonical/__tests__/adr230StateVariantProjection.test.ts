import { describe, expect, it } from "vitest";
import type { CompositionDocument, ResolvedNode } from "@composition/shared";
import { resolveCanonicalDocument } from "../index";

function findIn(nodes: ResolvedNode[], id: string): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.children ? findIn(node.children, id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

function findResolved(nodes: ResolvedNode[], id: string): ResolvedNode {
  const hit = findIn(nodes, id);
  if (!hit) throw new Error(`missing ${id}`);
  return hit;
}

const document = {
  version: "composition-1.0",
  children: [
    {
      id: "page-components",
      type: "frame",
      metadata: { type: "page", systemOwned: true },
      children: [
        {
          id: "page-components-body",
          type: "body",
          children: [
            {
              id: "component-togglebutton",
              type: "ToggleButton",
              reusable: true,
              props: { children: "Toggle", style: { color: "#000000" } },
              metadata: { type: "catalog-origin" },
            },
            {
              id: "component-togglebutton--selected",
              type: "ToggleButton",
              reusable: true,
              props: { children: "Toggle", style: { color: "#ffffff" } },
              fills: [{ type: "color", color: "#ff0000" }],
              metadata: {
                type: "catalog-origin",
                variant: "selected",
                variantOf: "component-togglebutton",
              },
            },
            {
              id: "component-form",
              type: "Form",
              reusable: true,
              props: {},
              children: [
                {
                  id: "submit",
                  type: "ref",
                  ref: "component-togglebutton",
                  props: { children: "Submit" },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "page-home",
      type: "frame",
      metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
      children: [
        {
          id: "body-home",
          type: "body",
          children: [
            {
              id: "tb-1",
              type: "ref",
              ref: "component-togglebutton",
              props: { style: { opacity: 0.7 } },
            },
            { id: "form-1", type: "ref", ref: "component-form" },
          ],
        },
      ],
    },
  ],
} as unknown as CompositionDocument;

describe("ADR-230 Preview resolver — instance props._stateVariants (DOM 축, Skia 와 같은 projection)", () => {
  it("최상위 instance: 변형 집합 · default 소유 color · instance 명시 opacity", () => {
    const tree = resolveCanonicalDocument(document);
    const inst = findResolved(tree, "tb-1");
    expect(inst._resolvedFrom).toBe("component-togglebutton");
    expect(inst.props?._stateVariants).toMatchObject({
      originId: "component-togglebutton",
      sets: {
        selected: {
          style: { color: "#ffffff" },
          fills: [{ type: "color", color: "#ff0000" }],
        },
      },
      defaultOwned: ["color"],
      instanceOwned: ["opacity"],
    });
  });

  it("Form instance 안 ToggleButton ref (229 조합 자식) 도 projection 을 받는다", () => {
    const tree = resolveCanonicalDocument(document);
    const form = findResolved(tree, "form-1");
    const nested = form.children!.find(
      (c) => c._resolvedFrom === "component-togglebutton",
    )!;
    expect(nested.props?._stateVariants).toMatchObject({
      originId: "component-togglebutton",
      instanceOwned: [],
    });
  });

  it("변형 origin 자신과 default origin 은 projection 을 받지 않는다", () => {
    const tree = resolveCanonicalDocument(document);
    expect(
      findResolved(tree, "component-togglebutton").props?._stateVariants,
    ).toBeUndefined();
    expect(
      findResolved(tree, "component-togglebutton--selected").props
        ?._stateVariants,
    ).toBeUndefined();
  });
});
