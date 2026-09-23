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

// ADR-234 Phase 2 — Canvas 는 `_stateVariants` projection 을 싣지 않고 켜진 상태 층을 props 에 직접
//   겹친다 (origin → 상태 층 → instance 자기 patch). 이관 전 복제본 변형은 230 관리 키 계약 그대로.
describe("ADR-230 → 234 ref 해소 — 켜진 상태 층을 Skia 축 props 에 직접 겹친다", () => {
  it("최상위 instance: disabled 면 변형 opacity, instance 가 직접 저장한 키는 instance 가 이긴다", () => {
    const rawDisabled = make("inst", {
      type: "ref",
      ref: "component-button",
      props: { isDisabled: true },
    });
    const disabled = tree([rawDisabled]).elementsMap.get("inst")!;
    expect(disabled.props?.style).toEqual({ color: "#000000", opacity: 0.4 });
    expect(disabled.props?._stateVariants).toBeUndefined();

    const rawOwned = make("inst", {
      type: "ref",
      ref: "component-button",
      props: { isDisabled: true, style: { opacity: 0.9 } },
    });
    const owned = tree([rawOwned]).elementsMap.get("inst")!;
    expect(owned.props?.style).toEqual({ color: "#000000", opacity: 0.9 });

    const rawIdle = make("inst", {
      type: "ref",
      ref: "component-button",
      props: {},
    });
    expect(tree([rawIdle]).elementsMap.get("inst")!.props?.style).toEqual({
      color: "#000000",
    });
  });

  it("nested (Form instance 안 Button ref) 도 조상 그룹이 아닌 자기 상태로 층을 받는다 — 229 상속", () => {
    const disabledFormButton = make("submit", {
      type: "ref",
      ref: "component-button",
      parent_id: "component-form",
      props: { children: "Submit", isDisabled: true },
    });
    const elements = [button, buttonDisabled, form, disabledFormButton];
    const formInstance = make("form-inst", {
      type: "ref",
      ref: "component-form",
      props: {},
    });
    const t = resolveCanonicalRefTree({
      elements: [...elements, formInstance],
      elementsMap: new Map([...elements, formInstance].map((e) => [e.id, e])),
    });
    const nested = t.elementsMap.get("form-inst/submit")!;
    expect(nested.type).toBe("Button");
    expect(nested.props?.style).toEqual({ color: "#000000", opacity: 0.4 });
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
      props: { isDisabled: true },
    });
    const resolved = tree([link, inst]).elementsMap.get("l-inst")!;
    expect(resolved.props).toEqual({ children: "Link", isDisabled: true });
  });
});
