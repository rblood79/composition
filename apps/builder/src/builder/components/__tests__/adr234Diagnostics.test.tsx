import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { buildStateVariantProjection } from "../stateVariantResolution";

/**
 * ADR-234 Phase 0 — 진단 RED (breakdown §4 Phase 0 (a)~(d)).
 * `it` 인 항목은 G0 실측에서 이미 GREEN 이었던 기준선이다.
 *
 * `it.fails` = 현재 결함을 고정한다. 결함을 닫는 Phase 가 `it` 으로 바꾼다 (RED → GREEN):
 *   (a) ref 체인 · (d) `enabled` → Phase 1 · (b) 변형의 관리 키 밖 값 → Phase 2 · (c) 목록 틀의
 *   instance 자식 → Phase 3.
 */

afterEach(cleanup);

function page(children: CanonicalNode[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          { id: "body-1", type: "Body", props: {}, children } as CanonicalNode,
        ],
      } as CanonicalNode,
    ],
  } as CompositionDocument;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderResolved(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps: () => {},
        } as unknown as RenderContext
      }
    />,
  );
}

// ── (a) ref 체인 ────────────────────────────────────────────────────────────
// origin (Checkbox + Label 자식) ← 변형 (ref, root color · label descendants) ← instance 2개 (하나는
// 자기 descendants label 텍스트). 체인 끝 instance 는 origin 구조 + 변형 patch + 자기 patch 를 받아야 한다.
function chainDoc(): CompositionDocument {
  return page([
    {
      id: "origin",
      type: "Checkbox",
      reusable: true,
      props: { style: { color: "red" } },
      children: [
        {
          id: "origin__label",
          type: "Label",
          props: { children: "Base", style: { color: "red" } },
        },
      ],
    } as CanonicalNode,
    {
      id: "variant",
      type: "ref",
      ref: "origin",
      reusable: true,
      props: { style: { color: "blue" } },
      descendants: { origin__label: { style: { color: "green" } } },
    } as unknown as CanonicalNode,
    {
      id: "instance",
      type: "ref",
      ref: "variant",
      props: {},
      descendants: { origin__label: { children: "Custom" } },
    } as unknown as CanonicalNode,
    {
      id: "plain-instance",
      type: "ref",
      ref: "variant",
      props: {},
    } as unknown as CanonicalNode,
  ]);
}

type Probe = { type?: unknown; props?: Record<string, unknown> };
const styleColor = (node: Probe | undefined) =>
  (node?.props?.style as Record<string, unknown> | undefined)?.color;

describe("ADR-234 진단 (a) — instance → 변형 ref → origin 체인", () => {
  it("Preview resolver: 체인 끝 instance 가 origin 구조 · 변형 patch · 자기 patch 를 받는다", () => {
    const resolved = resolveCanonicalDocument(chainDoc()) as ResolvedNode[];
    for (const [id, text] of [
      ["instance", "Custom"],
      ["plain-instance", "Base"],
    ] as const) {
      const node = findResolved(resolved, id);
      expect(node?.type, id).toBe("Checkbox");
      expect(styleColor(node), id).toBe("blue");
      const label = (node?.children ?? [])[0] as Probe | undefined;
      expect(label?.type, id).toBe("Label");
      expect(label?.props?.children, id).toBe(text);
      expect(styleColor(label), id).toBe("green");
    }
  });

  it("Canvas scene: 체인 끝 instance 가 origin 구조 · 변형 patch · 자기 patch 를 받는다", () => {
    const model = buildCanonicalSceneModel(chainDoc());
    for (const [id, text] of [
      ["instance", "Custom"],
      ["plain-instance", "Base"],
    ] as const) {
      const node = model.sceneNodesMap.get(id) as Probe | undefined;
      expect(node?.type, id).toBe("Checkbox");
      expect(styleColor(node), id).toBe("blue");
      const label = (model.sceneChildrenByParent.get(id) ?? [])[0] as
        Probe | undefined;
      expect(label?.type, id).toBe("Label");
      expect(label?.props?.children, id).toBe(text);
      expect(styleColor(label), id).toBe("green");
    }
  });
});

// ── (b) 변형의 관리 키 밖 값 ────────────────────────────────────────────────
describe("ADR-234 진단 (b) — 변형의 padding · 자식 편집", () => {
  it.fails(
    "disabled 변형의 paddingLeft · label 색이 상태 적용 값에 실린다",
    () => {
      const origin = {
        id: "component-button",
        type: "Button",
        reusable: true,
        props: { children: "Button", style: {} },
      } as CanonicalNode;
      const variant = {
        id: "component-button--disabled",
        type: "Button",
        reusable: true,
        props: { children: "Button", style: { paddingLeft: 30 } },
        metadata: { variant: "disabled", variantOf: origin.id },
      } as unknown as CanonicalNode;
      const byId = new Map([
        [origin.id, origin],
        [variant.id, variant],
      ]);
      const projection = buildStateVariantProjection(origin, undefined, (id) =>
        byId.get(id),
      );
      expect(
        (projection?.sets.disabled?.style as Record<string, unknown>)
          ?.paddingLeft,
      ).toBe(30);
    },
  );
});

// ── (c) 목록 틀의 instance 자식 ─────────────────────────────────────────────
function tabListChildDoc(): CompositionDocument {
  return page([
    {
      id: "tab-origin",
      type: "Tab",
      reusable: true,
      props: {},
      children: [
        {
          id: "tab-origin__label",
          type: "Text",
          props: { slot: "label", children: "{label}" },
        },
      ],
    } as CanonicalNode,
    {
      id: "tabs",
      type: "Tabs",
      props: {},
      children: [
        {
          id: "tabs__list",
          type: "TabList",
          props: {},
          children: [
            {
              id: "tab-1",
              type: "ref",
              ref: "tab-origin",
              props: { id: "t1" },
              descendants: { "tab-origin__label": { children: "One" } },
            } as unknown as CanonicalNode,
          ],
        },
        {
          id: "tabs__panels",
          type: "TabPanels",
          props: {},
          children: [
            { id: "panel-1", type: "TabPanel", props: { itemId: "t1" } },
          ],
        },
      ],
    } as CanonicalNode,
  ]);
}

describe("ADR-234 진단 (c) — TabList 의 Tab instance 자식", () => {
  // Canvas 는 이미 ref 자식을 일반 scene 자식으로 실체화한다 (G0 실측 — F6 정정). 그림 모양 (Tab 행
  //   규칙 · 선택 표시) 은 Phase 3 G3 가 본다. 여기서는 현재 동작을 기준선으로 둔다.
  it("Canvas scene: TabList 아래에 Tab 자식이 실체화된다 (기준선 GREEN)", () => {
    const model = buildCanonicalSceneModel(tabListChildDoc());
    const children = model.sceneChildrenByParent.get("tabs__list") ?? [];
    expect(children.map((child) => child.type)).toContain("Tab");
  });

  it.fails("Preview DOM: TabList 안에 .react-aria-Tab 'One' 이 있다", () => {
    const resolved = findResolved(
      resolveCanonicalDocument(tabListChildDoc()) as ResolvedNode[],
      "tabs",
    )!;
    const { container } = renderResolved(resolved);
    const tabs = Array.from(container.querySelectorAll(".react-aria-Tab"));
    expect(tabs.map((tab) => tab.textContent)).toEqual(["One"]);
  });
});

// ── (d) enabled:false ───────────────────────────────────────────────────────
function hiddenChildDoc(): CompositionDocument {
  return page([
    {
      id: "card",
      type: "frame",
      props: {},
      children: [
        { id: "shown", type: "Text", props: { children: "Shown" } },
        {
          id: "hidden",
          type: "Text",
          enabled: false,
          props: { children: "Hidden" },
        } as unknown as CanonicalNode,
      ],
    } as CanonicalNode,
  ]);
}

describe("ADR-234 진단 (d) — enabled:false", () => {
  it("Canvas scene: 숨긴 자식이 scene 에서 빠진다", () => {
    const model = buildCanonicalSceneModel(hiddenChildDoc());
    expect(model.sceneNodesMap.has("shown")).toBe(true);
    expect(model.sceneNodesMap.has("hidden")).toBe(false);
  });

  it("Preview resolver: 숨긴 자식이 resolved 트리에서 빠진다", () => {
    const resolved = resolveCanonicalDocument(
      hiddenChildDoc(),
    ) as ResolvedNode[];
    expect(findResolved(resolved, "shown")).toBeDefined();
    expect(findResolved(resolved, "hidden")).toBeUndefined();
  });
});
