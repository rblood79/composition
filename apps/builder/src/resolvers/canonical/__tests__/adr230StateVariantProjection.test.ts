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

// ADR-234 Phase 2 — `_stateVariants` (230 관리 키 projection) 는 `_stateLayers` (두 leg 공용 층 집합 +
//   instance 소유 키) 로 대체. 이관 전 복제본 변형은 230 관리 키 계약 그대로 층이 된다.
describe("ADR-230 → 234 Preview resolver — instance props._stateLayers", () => {
  it("최상위 instance: 층 집합 (복제본 = 관리 키 + fills) · instance 소유 키 opacity", () => {
    const tree = resolveCanonicalDocument(document);
    const inst = findResolved(tree, "tb-1");
    expect(inst._resolvedFrom).toBe("component-togglebutton");
    expect(inst.props?._stateVariants).toBeUndefined();
    expect(inst.props?._stateLayers).toMatchObject({
      set: {
        originId: "component-togglebutton",
        layers: {
          selected: {
            props: { style: { color: "#ffffff" } },
            fills: [{ type: "color", color: "#ff0000" }],
          },
        },
      },
      own: { styleKeys: ["opacity"], propKeys: [], fills: false },
    });
  });

  it("Form instance 안 ToggleButton ref (229 조합 자식) 도 층을 받는다", () => {
    const tree = resolveCanonicalDocument(document);
    const form = findResolved(tree, "form-1");
    const nested = form.children!.find(
      (c) => c._resolvedFrom === "component-togglebutton",
    )!;
    expect(nested.props?._stateLayers).toMatchObject({
      set: { originId: "component-togglebutton" },
      own: { styleKeys: [] },
    });
  });

  it("변형 origin 자신과 default origin 은 층을 받지 않는다", () => {
    const tree = resolveCanonicalDocument(document);
    expect(
      findResolved(tree, "component-togglebutton").props?._stateLayers,
    ).toBeUndefined();
    expect(
      findResolved(tree, "component-togglebutton--selected").props
        ?._stateLayers,
    ).toBeUndefined();
  });
});
