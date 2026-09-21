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
  // ADR-199 R7 (2026-08-30 live 실측) — 인스턴스를 컴포넌트로 승격한 dual 노드
  // (`type:"ref"` + 자신의 `reusable:true`) 에서 캔버스 우클릭 메뉴가 "컴포넌트
  // 만들기" 를 띄웠다. 이미 원본인 노드를 다시 원본으로 만드는 no-op 진입점이다.
  // 원인은 해소가 원본의 `reusable` 누수를 막으려고 필드를 통째로 지운 것 —
  // 인스턴스 **자신의** 축까지 같이 사라졌다.
  it("keeps the instance's own reusable and never inherits the origin's", () => {
    const origin = makeElement("origin", { type: "Button", reusable: true });
    const plain = makeElement("plain", {
      type: "ref",
      ref: "origin",
    } as never);
    const promoted = makeElement("promoted", {
      type: "ref",
      ref: "origin",
      reusable: true,
    } as never);

    const resolvedPlain = resolveCanonicalRefElement(plain, [origin, plain]);
    const resolvedPromoted = resolveCanonicalRefElement(promoted, [
      origin,
      promoted,
    ]);

    // 원본의 축은 넘어오지 않는다 — 모든 인스턴스가 원본으로 보이면 안 된다
    expect((resolvedPlain as { reusable?: boolean }).reusable).toBeUndefined();
    // 자신이 승격된 노드는 두 축을 다 갖는다 (패널이 "Instance · Origin" 으로 읽는 상태)
    expect((resolvedPromoted as { reusable?: boolean }).reusable).toBe(true);
    expect(resolvedPromoted.type).toBe("Button");
  });

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

describe("ADR-148 Phase 3 — depth-2 템플릿 바인딩 (Card 4-region 동형)", () => {
  it("중첩 region 자식(depth-2)의 placeholder 도 root override/default 로 치환된다", () => {
    const origin = makeElement("component-card", {
      type: "Card",
      reusable: true,
      props: { variant: "primary", size: "md" },
      metadata: {
        propsSchema: {
          title: { kind: "string", label: "Title", default: "Card Title" },
          description: {
            kind: "string",
            label: "Description",
            default: "Card description text goes here.",
          },
        },
      },
    } as never);
    const header = makeElement("component-card__header", {
      type: "CardHeader",
      parent_id: "component-card",
      name: "Header",
      props: {},
    } as never);
    const title = makeElement("component-card__title", {
      type: "Heading",
      parent_id: "component-card__header",
      name: "Title",
      props: { children: "{title}" },
    } as never);
    const content = makeElement("component-card__content", {
      type: "CardContent",
      parent_id: "component-card",
      name: "Content",
      props: {},
    } as never);
    const description = makeElement("component-card__description", {
      type: "Description",
      parent_id: "component-card__content",
      name: "Description",
      props: { children: "{description}" },
    } as never);
    const instance = makeElement("instance", {
      type: "ref",
      ref: "component-card",
      parent_id: "body",
      props: { title: "Quarterly Report" },
    } as never);
    const elements = [origin, header, title, content, description, instance];
    const tree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });

    // depth-2 synthetic id = `${instanceId}/${parentSegment}/${childSegment}`
    expect(tree.elementsMap.get("instance/Header/Title")?.props).toMatchObject({
      children: "Quarterly Report",
    });
    expect(
      tree.elementsMap.get("instance/Content/Description")?.props,
    ).toMatchObject({
      children: "Card description text goes here.",
    });
  });
});

describe("ADR-229 Phase 0 — 일반 origin-child ref (조합 origin 안 instance) 실체화", () => {
  // 조합 origin (Toolbar/Form) 의 자식이 다른 origin (Button/TextField) 의 ref 인 proposed
  // fixture. override.children (mode C) 경로만 중첩 master 를 해소하고 일반 source-child
  // 경로는 ref 를 그대로 복제하던 것이 리뷰 h1 의 진단 RED (F5).
  function buildToolbarFixture(options?: {
    outerDescendants?: Record<string, unknown>;
    compositeChildProps?: Record<string, unknown>;
  }) {
    const button = makeElement("component-button", {
      type: "Button",
      reusable: true,
      props: { children: "Button", variant: "primary", size: "md" },
    });
    const toolbar = makeElement("component-toolbar", {
      type: "Toolbar",
      reusable: true,
      props: { orientation: "horizontal" },
    });
    const action = makeElement("component-toolbar__action-1", {
      type: "ref",
      ref: "component-button",
      parent_id: "component-toolbar",
      props: options?.compositeChildProps ?? { children: "Save" },
    } as never);
    const separator = makeElement("component-toolbar__sep", {
      type: "Separator",
      parent_id: "component-toolbar",
      props: { orientation: "vertical" },
    });
    const instance = makeElement("toolbar-1", {
      type: "ref",
      ref: "component-toolbar",
      parent_id: "body",
      ...(options?.outerDescendants
        ? { descendants: options.outerDescendants }
        : {}),
    } as never);
    const elements = [button, toolbar, action, separator, instance];
    return {
      elements,
      tree: resolveCanonicalRefTree({
        elements,
        elementsMap: new Map(elements.map((e) => [e.id, e])),
      }),
    };
  }

  it("조합 origin 의 ref 자식이 바깥 instance 안에서 자기 origin 타입으로 실체화된다 (master props ⊕ 자식 patch)", () => {
    const { tree } = buildToolbarFixture();
    const nested = tree.elementsMap.get(
      "toolbar-1/component-toolbar__action-1",
    );
    expect(nested).toMatchObject({
      type: "Button",
      ref: "component-button",
      parent_id: "toolbar-1",
      props: { children: "Save", variant: "primary", size: "md" },
    });
    expect(
      (nested as { reusable?: boolean } | undefined)?.reusable,
    ).toBeUndefined();
    // 형제 plain 자식과 순서 보존
    expect(tree.childrenMap.get("toolbar-1")?.map((c) => c.id)).toEqual([
      "toolbar-1/component-toolbar__action-1",
      "toolbar-1/component-toolbar__sep",
    ]);
  });

  it("바깥 instance 의 descendants patch 가 자식 patch 와 nested master 위에 이긴다 (master → 자식 → 바깥 순)", () => {
    const { tree } = buildToolbarFixture({
      outerDescendants: {
        "component-toolbar__action-1": { variant: "accent", children: "Go" },
      },
    });
    expect(
      tree.elementsMap.get("toolbar-1/component-toolbar__action-1")?.props,
    ).toEqual({ children: "Go", variant: "accent", size: "md" });
  });

  it("입력 요소는 변형하지 않는다 (원본 불변)", () => {
    const { elements, tree } = buildToolbarFixture({
      outerDescendants: {
        "component-toolbar__action-1": { variant: "accent" },
      },
    });
    const snapshot = JSON.parse(JSON.stringify(elements));
    expect(tree.elementsMap.size).toBeGreaterThan(elements.length);
    expect(JSON.parse(JSON.stringify(elements))).toEqual(snapshot);
    expect(
      elements.find((e) => e.id === "component-toolbar__action-1")?.type,
    ).toBe("ref");
  });

  it("nested master 의 자식 (TextField 의 Label/Input) 이 깊은 path 로 실체화되고 바깥 patch 가 그 path 로 닿는다", () => {
    const textField = makeElement("component-textfield", {
      type: "TextField",
      reusable: true,
      props: { label: "Field" },
    });
    const label = makeElement("component-textfield__1", {
      type: "Label",
      parent_id: "component-textfield",
      props: { children: "Field" },
    });
    const input = makeElement("component-textfield__2", {
      type: "Input",
      parent_id: "component-textfield",
      props: { placeholder: "" },
    });
    const form = makeElement("component-form", {
      type: "Form",
      reusable: true,
      props: {},
    });
    const field = makeElement("component-form__field-1", {
      type: "ref",
      ref: "component-textfield",
      parent_id: "component-form",
      props: { label: "Name" },
    } as never);
    const instance = makeElement("form-1", {
      type: "ref",
      ref: "component-form",
      parent_id: "body",
      descendants: {
        "component-form__field-1/component-textfield__1": {
          children: "Email",
        },
      },
    } as never);
    const elements = [textField, label, input, form, field, instance];
    const tree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });

    expect(
      tree.elementsMap.get("form-1/component-form__field-1"),
    ).toMatchObject({
      type: "TextField",
      props: { label: "Name" },
    });
    expect(
      tree.childrenMap.get("form-1/component-form__field-1")?.map((c) => c.id),
    ).toEqual([
      "form-1/component-form__field-1/component-textfield__1",
      "form-1/component-form__field-1/component-textfield__2",
    ]);
    expect(
      tree.elementsMap.get(
        "form-1/component-form__field-1/component-textfield__1",
      ),
    ).toMatchObject({
      type: "Label",
      parent_id: "form-1/component-form__field-1",
      props: { children: "Email" },
    });
  });

  it("nested master 가 propsSchema 를 선언하면 자식 ref 의 유효 props 로 `{키}` 를 재바인딩한다", () => {
    const card = makeElement("component-card", {
      type: "Card",
      reusable: true,
      props: { title: "Card" },
      metadata: {
        propsSchema: {
          title: { kind: "string", label: "Title", default: "Card" },
        },
      },
    } as never);
    const cardTitle = makeElement("component-card__title", {
      type: "Text",
      parent_id: "component-card",
      props: { children: "{title}" },
    });
    const panel = makeElement("component-panel", {
      type: "Panel",
      reusable: true,
      props: {},
    });
    const panelCard = makeElement("component-panel__card", {
      type: "ref",
      ref: "component-card",
      parent_id: "component-panel",
      props: { title: "Inside panel" },
    } as never);
    const instance = makeElement("panel-1", {
      type: "ref",
      ref: "component-panel",
      parent_id: "body",
      descendants: { "component-panel__card": { title: "Overridden" } },
    } as never);
    const elements = [card, cardTitle, panel, panelCard, instance];
    const tree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });
    expect(
      tree.elementsMap.get(
        "panel-1/component-panel__card/component-card__title",
      )?.props,
    ).toMatchObject({ children: "Overridden" });
  });

  it("scene 층 모양 — 자식 ref 의 type 이 이미 master type 으로 바뀌고 `.ref` 만 남아도 nested master 자식을 실체화한다", () => {
    // buildCanvasSceneGraph (ADR-161) 는 ref 노드의 type 을 master type 으로, props 를 master ⊕ 자식으로 바꾼다.
    const textField = makeElement("component-textfield", {
      type: "TextField",
      reusable: true,
      props: { label: "Field" },
    });
    const label = makeElement("component-textfield__1", {
      type: "Label",
      parent_id: "component-textfield",
      props: { children: "Field" },
    });
    const form = makeElement("component-form", {
      type: "Form",
      reusable: true,
      props: {},
    });
    const field = makeElement("component-form__field-1", {
      type: "TextField",
      ref: "component-textfield",
      parent_id: "component-form",
      props: { label: "Name" },
    } as never);
    const instance = makeElement("form-1", {
      type: "Form",
      ref: "component-form",
      parent_id: "body",
    } as never);
    const elements = [textField, label, form, field, instance];
    const tree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });
    expect(
      tree.childrenMap.get("form-1/component-form__field-1")?.map((c) => c.id),
    ).toEqual(["form-1/component-form__field-1/component-textfield__1"]);
    expect(
      tree.elementsMap.get("form-1/component-form__field-1")?.props,
    ).toMatchObject({
      label: "Name",
    });
  });

  it("origin 끼리 서로를 참조하는 순환은 유한하게 끝난다", () => {
    const a = makeElement("origin-a", { type: "Group", reusable: true });
    const aChild = makeElement("origin-a__b", {
      type: "ref",
      ref: "origin-b",
      parent_id: "origin-a",
    } as never);
    const b = makeElement("origin-b", { type: "Group", reusable: true });
    const bChild = makeElement("origin-b__a", {
      type: "ref",
      ref: "origin-a",
      parent_id: "origin-b",
    } as never);
    const instance = makeElement("a-1", {
      type: "ref",
      ref: "origin-a",
      parent_id: "body",
    } as never);
    const elements = [a, aChild, b, bChild, instance];
    const tree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });
    expect(tree.elementsMap.get("a-1/origin-a__b")?.type).toBe("Group");
    expect(tree.elements.length).toBeLessThan(elements.length + 8);
  });

  it("일반 source-child 경로와 override.children (mode C) 경로가 같은 fixture 에 같은 모양을 낸다", () => {
    const { tree: sourceTree } = buildToolbarFixture();
    const sourceChild = sourceTree.elementsMap.get(
      "toolbar-1/component-toolbar__action-1",
    );

    const button = makeElement("component-button", {
      type: "Button",
      reusable: true,
      props: { children: "Button", variant: "primary", size: "md" },
    });
    const host = makeElement("component-host", {
      type: "Toolbar",
      reusable: true,
      props: { orientation: "horizontal" },
    });
    const slot = makeElement("component-host__slot", {
      type: "frame",
      parent_id: "component-host",
      customId: "slot",
      slot: ["component-button"],
    } as never);
    const instance = makeElement("host-1", {
      type: "ref",
      ref: "component-host",
      parent_id: "body",
      descendants: {
        slot: {
          children: [
            {
              id: "component-toolbar__action-1",
              type: "ref",
              ref: "component-button",
              props: { children: "Save" },
            },
          ],
        },
      },
    } as never);
    const elements = [button, host, slot, instance];
    const overrideTree = resolveCanonicalRefTree({
      elements,
      elementsMap: new Map(elements.map((e) => [e.id, e])),
    });
    const overrideChild = overrideTree.elementsMap.get(
      "host-1/slot/component-toolbar__action-1",
    );
    expect(overrideChild).toBeDefined();
    const shape = (element: Element | undefined) => ({
      type: element?.type,
      ref: (element as { ref?: string } | undefined)?.ref,
      props: element?.props,
    });
    expect(shape(sourceChild)).toEqual(shape(overrideChild));
  });
});
