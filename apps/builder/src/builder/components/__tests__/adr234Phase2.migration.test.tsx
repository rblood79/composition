import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveTemplateOriginNode } from "../../workspace/canvas/scene/canvasSceneNode";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";
import { migrateVariantsToOriginInstances } from "../stateVariantMigration";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";

/**
 * ADR-234 Phase 2 — G2 이관 (breakdown §4 Phase 2 이관 · review round 1 h1 · h2).
 *
 * 이관 전 모양 (230 복제본 · 229/233 항목 템플릿 default/selected) 에 사용자 편집을 얹은 문서를
 * `migrateVariantsToOriginInstances` 로 옮기고, 같은 해석기 (두 leg) 로 이관 전 · 후 유효값이 같은지 잰다.
 * 이관 전 복제본은 230 계약 (관리 키 + fills) 으로 읽힌다 (`stateVariantResolution.test.ts` · Skia 230
 * 계약 테스트가 그 판독이 230 결과와 같음을 고정).
 */

afterEach(cleanup);

const RED = {
  id: "r",
  type: "color",
  color: "#ff0000",
  opacity: 1,
  enabled: true,
};
const BLUE = {
  id: "b",
  type: "color",
  color: "#0000ff",
  opacity: 1,
  enabled: true,
};

function doc(
  components: CanonicalNode[],
  user: CanonicalNode[],
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "page", systemOwned: true },
        children: [
          {
            id: COMPONENTS_SYSTEM_BODY_ID,
            type: "body",
            props: {},
            children: components,
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [{ id: "body-1", type: "body", props: {}, children: user }],
      },
    ],
  } as unknown as CompositionDocument;
}

function checkboxFamily(): CanonicalNode[] {
  const origin = {
    id: "component-checkbox",
    type: "Checkbox",
    reusable: true,
    props: { children: "Check", style: { color: "#111111" } },
    fills: [BLUE],
    children: [
      {
        id: "component-checkbox__label",
        type: "Label",
        props: { children: "Check" },
      },
    ],
    metadata: { type: "catalog-origin", componentFamily: "Checkbox" },
  } as unknown as CanonicalNode;
  const clone = (state: string, style: Record<string, unknown>, extra = {}) =>
    ({
      id: `component-checkbox--${state}`,
      type: "Checkbox",
      reusable: true,
      props: { children: "Check", style },
      children: [
        {
          id: `component-checkbox--${state}__1`,
          type: "Label",
          props: { children: "Check" },
        },
      ],
      metadata: {
        type: "catalog-origin",
        variant: state,
        variantOf: "component-checkbox",
      },
      ...extra,
    }) as unknown as CanonicalNode;
  return [
    origin,
    // selected: 배경 빨강 · 글자 흰색 · 관리 키 밖 padding (230 이 무시하던 값 — 이관에서 버린다)
    clone("selected", { color: "#ffffff", paddingLeft: 40 }, { fills: [RED] }),
    clone("disabled", { opacity: 0.5 }),
    clone("hover", { borderColor: "#00ff00" }),
  ];
}

function userInstances(): CanonicalNode[] {
  return [
    { id: "idle", type: "ref", ref: "component-checkbox", props: {} },
    {
      id: "checked",
      type: "ref",
      ref: "component-checkbox",
      props: { isSelected: true },
    },
    {
      id: "checked-off",
      type: "ref",
      ref: "component-checkbox",
      props: { isSelected: true, isDisabled: true },
    },
    {
      id: "idle-off",
      type: "ref",
      ref: "component-checkbox",
      props: { isDisabled: true },
    },
    {
      id: "own",
      type: "ref",
      ref: "component-checkbox",
      props: { isDisabled: true, style: { opacity: 0.9, color: "#123456" } },
    },
    // 변형을 **직접** ref 한 사용자 노드 (h2) — hover 복제본 자식 id 로 label 편집
    {
      id: "direct-hover",
      type: "ref",
      ref: "component-checkbox--hover",
      props: {},
      descendants: { "component-checkbox--hover__1": { children: "Custom" } },
    },
    // 옛 `--selected` 를 직접 ref 한 노드 → origin 으로 대상 교체
    {
      id: "direct-selected",
      type: "ref",
      ref: "component-checkbox--selected",
      props: { isSelected: true },
    },
  ] as unknown as CanonicalNode[];
}

const INSTANCE_IDS = ["idle", "checked", "checked-off", "idle-off", "own"];

type Visual = { style: Record<string, unknown>; fills: unknown };

function canvasVisuals(document: CompositionDocument): Record<string, Visual> {
  const model = buildCanonicalSceneModel(document);
  return Object.fromEntries(
    INSTANCE_IDS.map((id) => {
      const node = model.sceneNodesMap.get(id)!;
      return [
        id,
        {
          style: (node.props?.style ?? {}) as Record<string, unknown>,
          fills: node.fills ?? null,
        },
      ];
    }),
  );
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

function previewStyle(document: CompositionDocument, id: string) {
  const node = findResolved(
    resolveCanonicalDocument(document) as ResolvedNode[],
    id,
  )!;
  const { container, unmount } = render(
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
  const el = container.querySelector<HTMLElement>(".react-aria-Checkbox")!;
  const out = {
    color: el.style.color,
    opacity: el.style.opacity,
    background: el.style.backgroundColor || el.style.background,
    paddingLeft: el.style.paddingLeft,
  };
  unmount();
  return out;
}

describe("ADR-234 G2 — 230 복제본 가족 이관 (Checkbox)", () => {
  const before = doc(checkboxFamily(), userInstances());
  const after = migrateVariantsToOriginInstances(before);
  const body = (d: CompositionDocument) =>
    (d.children[0]!.children![0]!.children ?? []) as CanonicalNode[];
  const byId = (d: CompositionDocument) =>
    new Map(body(d).map((n) => [n.id, n]));

  it("모양 — origin id 고정 · 선택 상태로 다시 씀 · --selected 제거 · --unselected 추가 · 나머지 변형 = ref + 그 상태 키만", () => {
    const nodes = byId(after);
    const origin = nodes.get("component-checkbox")!;
    expect(origin.type).toBe("Checkbox");
    expect(origin.metadata).toMatchObject({ variant: "selected" });
    expect(origin.props?.style).toEqual({ color: "#ffffff" });
    expect(origin.fills).toEqual([RED]);
    // 자식 id 유지 (사용자 instance descendants Δ0)
    expect(origin.children?.map((c) => c.id)).toEqual([
      "component-checkbox__label",
    ]);
    expect(nodes.has("component-checkbox--selected")).toBe(false);
    expect(body(after).map((n) => n.id)).toEqual([
      "component-checkbox",
      "component-checkbox--unselected",
      "component-checkbox--disabled",
      "component-checkbox--hover",
    ]);
    const unselected = nodes.get("component-checkbox--unselected")!;
    expect(unselected).toMatchObject({
      type: "ref",
      ref: "component-checkbox",
      props: { style: { color: "#111111" } },
      fills: [BLUE],
      metadata: { variant: "unselected" },
    });
    expect(nodes.get("component-checkbox--disabled")).toMatchObject({
      type: "ref",
      ref: "component-checkbox",
      props: { style: { opacity: 0.5 } },
    });
    expect(nodes.get("component-checkbox--disabled")?.children).toBeUndefined();
    // 관리 키 밖 raw 값 (paddingLeft 40) 은 어디에도 남지 않는다 — 이관이 새 모양을 켜지 않는다.
    expect(JSON.stringify(after)).not.toContain("paddingLeft");
  });

  it("h1 — origin 에만 있는 키는 휴지 변형이 null 로 되돌린다 (원본 값이 되살아나지 않음)", () => {
    const family = checkboxFamily();
    // default 에 color 가 없고 selected 만 color 를 준다 → 휴지 변형은 color: null.
    (family[0]!.props as Record<string, unknown>).style = {};
    const migrated = migrateVariantsToOriginInstances(doc(family, []));
    const unselected = byId(migrated).get("component-checkbox--unselected")!;
    expect(unselected.props?.style).toEqual({ color: null });
    const model = buildCanonicalSceneModel(
      doc(body(migrated), [
        {
          id: "idle",
          type: "ref",
          ref: "component-checkbox",
          props: {},
        } as unknown as CanonicalNode,
      ]),
    );
    expect(model.sceneNodesMap.get("idle")?.props?.style).toEqual({});
  });

  it("h2 — 변형을 직접 ref 한 노드: 복제본 자식 id → origin 자식 id 로 descendants 이동 · label 편집 보존 · --selected 대상은 origin", () => {
    const user = new Map(
      (after.children[1]!.children![0]!.children ?? []).map((n) => [n.id, n]),
    );
    expect(user.get("direct-hover")).toMatchObject({
      ref: "component-checkbox--hover",
      descendants: { "component-checkbox__label": { children: "Custom" } },
    });
    expect(user.get("direct-selected")).toMatchObject({
      ref: "component-checkbox",
    });
    const model = buildCanonicalSceneModel(after);
    const label = (model.sceneChildrenByParent.get("direct-hover") ?? [])[0];
    expect(label?.props?.children).toBe("Custom");
    const previewLabel = findResolved(
      resolveCanonicalDocument(after) as ResolvedNode[],
      "direct-hover",
    )?.children?.[0];
    expect(previewLabel?.props?.children).toBe("Custom");
    // 일반 instance 는 Δ0 (사용자 노드 직렬화 그대로)
    for (const id of INSTANCE_IDS) {
      expect(JSON.stringify(user.get(id))).toBe(
        JSON.stringify(
          (before.children[1]!.children![0]!.children ?? []).find(
            (n) => n.id === id,
          ),
        ),
      );
    }
  });

  it("Canvas scene — 이관 전 · 후 instance 유효값 동일 (휴지 · 선택 · 선택+disabled · 휴지+disabled · instance 소유 키)", () => {
    const pre = canvasVisuals(before);
    const post = canvasVisuals(after);
    expect(post).toEqual(pre);
    // 기대값 (230 계약) — 선택+disabled 는 선택 배경 유지 (층 합성, 전체 차분이면 휴지 배경이 된다)
    expect(post.checked).toEqual({
      style: { color: "#ffffff" },
      fills: [RED],
    });
    expect(post["checked-off"]).toEqual({
      style: { color: "#ffffff", opacity: 0.5 },
      fills: [RED],
    });
    expect(post["idle-off"]).toEqual({
      style: { color: "#111111", opacity: 0.5 },
      fills: [BLUE],
    });
    expect(post.own).toEqual({
      style: { color: "#123456", opacity: 0.9 },
      fills: [BLUE],
    });
  });

  it("Preview DOM — 이관 전 · 후 instance style 동일 (RAC render props)", () => {
    for (const id of INSTANCE_IDS) {
      expect(previewStyle(after, id), id).toEqual(previewStyle(before, id));
    }
    expect(previewStyle(after, "checked-off")).toMatchObject({
      color: "rgb(255, 255, 255)",
      opacity: "0.5",
    });
    expect(previewStyle(after, "own")).toMatchObject({
      color: "rgb(18, 52, 86)",
      opacity: "0.9",
    });
  });

  it("멱등 — 두 번째 이관은 같은 문서 객체", () => {
    expect(migrateVariantsToOriginInstances(after)).toBe(after);
  });
});

describe("ADR-234 G2 — 항목 템플릿 이관 (Tab · Tag · ListBoxItem)", () => {
  const seeded = ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [],
  } as CompositionDocument);
  const nodesById = new Map<string, CanonicalNode>();
  const walk = (nodes: readonly CanonicalNode[]) => {
    for (const n of nodes) {
      nodesById.set(n.id, n);
      walk(n.children ?? []);
    }
  };
  walk(seeded.children);

  it("seed 문서 — origin (default id) = 선택 모양 · 휴지 변형 = ref · slot = [휴지, origin]", () => {
    for (const [origin, host] of [
      // ADR-234 Phase 3 — Tabs 의 slot 은 목록 틀 (TabList) 로 옮겨졌다.
      ["component-tab-item-default", "component-tabs__1"],
      ["component-tag-item-default", "component-taggroup"],
      ["component-listbox-item-default", "component-listbox"],
    ]) {
      expect(nodesById.get(origin)?.metadata, origin).toMatchObject({
        variant: "selected",
      });
      expect(nodesById.get(`${origin}--unselected`), origin).toMatchObject({
        type: "ref",
        ref: origin,
        metadata: { variant: "unselected" },
      });
      expect(nodesById.get(host)?.slot, host).toEqual([
        `${origin}--unselected`,
        origin,
      ]);
      expect(
        nodesById.has(origin.replace("-default", "-selected")),
        origin,
      ).toBe(false);
    }
  });

  it("ListBoxItem — 휴지 변형이 선택 배경을 지운다 (backgroundColor: null) · 자식 구조는 origin 것", () => {
    const unselected = resolveTemplateOriginNode(
      "component-listbox-item-default--unselected",
      nodesById,
    )!;
    const origin = nodesById.get("component-listbox-item-default")!;
    expect(origin.props?.style).toMatchObject({
      backgroundColor: "var(--accent-subtle)",
    });
    expect(unselected.props?.style).not.toHaveProperty("backgroundColor");
    expect(unselected.children?.map((c) => c.id)).toEqual(
      origin.children?.map((c) => c.id),
    );
  });

  it("Tab · Tag — 휴지 변형은 `_isSelected` 를 지운다 (origin 만 선택으로 그린다)", () => {
    for (const id of [
      "component-tab-item-default",
      "component-tag-item-default",
    ]) {
      expect(nodesById.get(id)?.props?._isSelected, id).toBe(true);
      expect(
        resolveTemplateOriginNode(`${id}--unselected`, nodesById)?.props,
        id,
      ).not.toHaveProperty("_isSelected");
    }
  });
});

describe("ADR-234 G2 — 상태 층의 geometry 가 layout 입력에 닿는다 (R9)", () => {
  it("disabled 층 paddingLeft 는 scene props 에 실려 layout 캐시 서명이 바뀐다 · 색만 바꾸는 층은 서명 그대로", async () => {
    const { createPageLayoutSignature } =
      await import("../../workspace/canvas/scene/layoutCache");
    const family = (disabledStyle: Record<string, unknown>) =>
      [
        {
          id: "component-button",
          type: "Button",
          reusable: true,
          props: { children: "B" },
          metadata: { type: "catalog-origin" },
        },
        {
          id: "component-button--disabled",
          type: "ref",
          ref: "component-button",
          reusable: true,
          props: { style: disabledStyle },
          metadata: { type: "catalog-origin", variant: "disabled" },
        },
      ] as unknown as CanonicalNode[];
    const signature = (
      disabledStyle: Record<string, unknown>,
      isDisabled: boolean,
    ) => {
      const model = buildCanonicalSceneModel(
        doc(family(disabledStyle), [
          {
            id: "btn",
            type: "ref",
            ref: "component-button",
            props: { isDisabled },
          } as unknown as CanonicalNode,
        ]),
      );
      const node = model.sceneNodesMap.get("btn")!;
      return createPageLayoutSignature(null, [
        node as unknown as Parameters<
          typeof createPageLayoutSignature
        >[1][number],
      ]);
    };
    expect(signature({ paddingLeft: 30 }, true)).not.toBe(
      signature({ paddingLeft: 30 }, false),
    );
    expect(signature({ color: "#999999" }, true)).toBe(
      signature({ color: "#999999" }, false),
    );
  });
});

describe("ADR-234 G2 — Preview 는 RAC 실행 중 상태로 층을 고른다 (render props)", () => {
  it("Button 에 키보드 포커스가 오면 props 는 그대로여도 RAC focus-visible 로 그 층이 켜진다", async () => {
    const { act, fireEvent } = await import("@testing-library/react");
    const document = doc(
      [
        {
          id: "component-button",
          type: "Button",
          reusable: true,
          props: { children: "B" },
          metadata: { type: "catalog-origin" },
        },
        {
          id: "component-button--focus-visible",
          type: "ref",
          ref: "component-button",
          reusable: true,
          props: { style: { color: "#ff0000" } },
          metadata: { type: "catalog-origin", variant: "focus-visible" },
        },
      ] as unknown as CanonicalNode[],
      [
        {
          id: "btn",
          type: "ref",
          ref: "component-button",
          props: {},
        } as unknown as CanonicalNode,
      ],
    );
    const node = findResolved(
      resolveCanonicalDocument(document) as ResolvedNode[],
      "btn",
    )!;
    const { container } = render(
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
    const button = () =>
      container.querySelector<HTMLElement>(".react-aria-Button")!;
    expect(button().style.color).toBe("");
    act(() => {
      fireEvent.keyDown(window.document.body, { key: "Tab" });
      button().focus();
    });
    expect(button().hasAttribute("data-focus-visible")).toBe(true);
    expect(button().style.color).toBe("rgb(255, 0, 0)");
  });
});
