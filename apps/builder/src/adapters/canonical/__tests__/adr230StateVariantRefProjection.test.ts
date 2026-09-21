import { describe, expect, it } from "vitest";
import { resolveCanonicalRefTree } from "../canonicalRefResolution";

type Node = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  reusable?: boolean;
  ref?: string;
  fills?: unknown[];
  metadata?: Record<string, unknown>;
  sourceNode?: unknown;
};

function make(id: string, node: Partial<Node>): Node {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "p",
    ...node,
  };
}

const button = make("component-button", {
  reusable: true,
  props: { children: "Button", style: { color: "#000000" } },
  metadata: { type: "catalog-origin", componentFamily: "Button" },
});
const buttonDisabled = make("component-button--disabled", {
  reusable: true,
  props: { children: "Button", style: { opacity: 0.4 } },
  metadata: {
    type: "catalog-origin",
    variant: "disabled",
    variantOf: "component-button",
  },
});
const form = make("component-form", {
  type: "Form",
  reusable: true,
  props: {},
  metadata: { type: "form-template-origin" },
});
const formButton = make("submit", {
  type: "ref",
  ref: "component-button",
  parent_id: "component-form",
  props: { children: "Submit" },
});

function tree(extra: Node[]) {
  const elements = [button, buttonDisabled, form, formButton, ...extra];
  return resolveCanonicalRefTree({
    elements,
    elementsMap: new Map(elements.map((e) => [e.id, e])),
  });
}

describe("ADR-230 ref 해소 — instance props 에 _stateVariants projection (Skia 축)", () => {
  it("최상위 instance: 변형 집합 · default 소유 키(color) · instance 명시 키(opacity) 를 raw ref 노드로 판정", () => {
    const rawInstance = make("inst", {
      type: "ref",
      ref: "component-button",
      props: { style: { opacity: 0.9 } },
    });
    // scene 층은 origin props 를 이미 깔아 둔다 (ADR-228) — sourceNode 가 raw ref.
    const sceneInstance = make("inst", {
      type: "Button",
      ref: "component-button",
      props: { children: "Button", style: { color: "#000000", opacity: 0.9 } },
      sourceNode: rawInstance,
    });
    const resolved = tree([sceneInstance]).elementsMap.get("inst")!;
    const projection = resolved.props?._stateVariants as Record<
      string,
      unknown
    >;
    expect(projection).toMatchObject({
      originId: "component-button",
      sets: { disabled: { style: { opacity: 0.4 } } },
      defaultOwned: ["color"],
      instanceOwned: ["opacity"],
    });
  });

  it("nested (Form instance 안 Button ref) 도 synthetic 자식이 projection 을 받는다 — 229 상속", () => {
    const formInstance = make("form-inst", {
      type: "ref",
      ref: "component-form",
      props: {},
    });
    const t = tree([formInstance]);
    const nested = t.elementsMap.get("form-inst/submit")!;
    expect(nested.type).toBe("Button");
    expect(nested.props?._stateVariants).toMatchObject({
      originId: "component-button",
      sets: { disabled: { style: { opacity: 0.4 } } },
      instanceOwned: [],
    });
  });

  it("변형이 없는 origin 의 instance 는 무변경 (plain 과 같은 경로)", () => {
    const link = make("component-link", {
      type: "Link",
      reusable: true,
      props: { children: "Link" },
    });
    const inst = make("l-inst", {
      type: "ref",
      ref: "component-link",
      props: {},
    });
    const resolved = tree([link, inst]).elementsMap.get("l-inst")!;
    expect(resolved.props?._stateVariants).toBeUndefined();
  });
});
