import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  isDisclosureExpandedInContext,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { STATE_LAYER_ORDER, buildStateLayerSet } from "../stateVariantLayers";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

/**
 * ADR-237 Phase 2 — G2 (breakdown §4 Phase 2): 항목 템플릿 5종 상호작용 변형 · GridListItem 선택 쌍 이관 ·
 * Disclosure `--collapsed` (props + style 만) · 유효 펼침 = 강제 → `isDisclosureExpandedInContext` (Canvas) /
 * RAC render prop `isExpanded` (Preview) · 접힘 층의 구조 patch 거부 · 234 층 순서 계승.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const RED = "#ff0000";
const RED_RGB = "rgb(255, 0, 0)";

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function find(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

function mapNodes(
  document: CompositionDocument,
  fn: (node: CanonicalNode) => CanonicalNode | null,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] => {
    const out: CanonicalNode[] = [];
    for (const node of nodes) {
      const next = fn(node);
      if (!next) continue;
      out.push(
        next.children ? { ...next, children: visit(next.children) } : next,
      );
    }
    return out;
  };
  return { ...document, children: visit(document.children) };
}

function countNodes(nodes: readonly CanonicalNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);
}

/** seed 문서의 변형 노드 props 를 바꾸고 user body 에 노드를 둔다. */
function withUser(
  base: CompositionDocument,
  userChildren: CanonicalNode[],
  variantProps: Record<string, Record<string, unknown>> = {},
): CompositionDocument {
  return mapNodes(base, (node) => {
    if (node.id === "body-1") return { ...node, children: userChildren };
    const patch = variantProps[node.id];
    return patch ? ({ ...node, ...patch } as CanonicalNode) : node;
  });
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

function renderResolved(document: CompositionDocument, id: string) {
  const node = findResolved(
    resolveCanonicalDocument(document) as ResolvedNode[],
    id,
  )!;
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

const sceneStyle = (
  model: ReturnType<typeof buildCanonicalSceneModel>,
  id: string,
) =>
  (model.sceneNodesMap.get(id)?.props?.style ?? {}) as Record<string, unknown>;

const ITEM_ORIGINS = [
  "component-tab-item-default",
  "component-tag-item-default",
  "component-listbox-item-default",
  "component-gridlist-item-default",
  "component-menu-item-default",
];
const INTERACTION = ["disabled", "hover", "pressed", "focus-visible"];

describe("ADR-237 G2 — seed · 이관 모양", () => {
  it("변형 26 = 항목 5 × 4 + GridListItem `--unselected` + Disclosure `--collapsed` + IconButton 4 · 재hydration Δ0", () => {
    const doc = seedDocument();
    for (const origin of ITEM_ORIGINS) {
      for (const state of INTERACTION) {
        expect(
          find(doc.children, `${origin}--${state}`),
          `${origin}--${state}`,
        ).toMatchObject({
          type: "ref",
          ref: origin,
          metadata: { variant: state },
        });
      }
    }
    expect(
      find(doc.children, "component-gridlist-item-default")?.metadata,
    ).toMatchObject({
      variant: "selected",
    });
    expect(
      (find(doc.children, "component-gridlist") as { slot?: unknown }).slot,
    ).toEqual([
      "component-gridlist-item-default--unselected",
      "component-gridlist-item-default",
    ]);
    const collapsed = find(doc.children, "component-disclosure--collapsed")!;
    expect(collapsed).toMatchObject({
      type: "ref",
      ref: "component-disclosure",
      props: { isExpanded: false },
      metadata: { variant: "collapsed" },
    });
    expect(JSON.stringify(collapsed)).not.toContain("enabled");
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("기존 문서 (234 모양) → 이관 Δnode 26 · 새 문서와 같은 모양", () => {
    const seeded = seedDocument();
    const added = new Set<string>([
      ...ITEM_ORIGINS.flatMap((o) => INTERACTION.map((s) => `${o}--${s}`)),
      "component-gridlist-item-default--unselected",
      "component-disclosure--collapsed",
      ...INTERACTION.map((s) => `component-iconbutton--${s}`),
    ]);
    expect(added.size).toBe(26);
    const pre = mapNodes(seeded, (node) => {
      if (added.has(node.id)) return null;
      if (node.id === "component-gridlist-item-default") {
        return {
          ...node,
          metadata: { ...(node.metadata ?? {}), variant: "default" },
        } as CanonicalNode;
      }
      if (node.id === "component-gridlist") {
        return {
          ...node,
          slot: ["component-gridlist-item-default"],
        } as CanonicalNode;
      }
      return node;
    });
    const post = ensureReusableCompositeOrigins(pre);
    expect(countNodes(post.children) - countNodes(pre.children)).toBe(26);
    expect(JSON.stringify(post)).toBe(JSON.stringify(seeded));
  });
});

// ── 항목 변형 편집이 해당 상태에만 (두 leg) ─────────────────────────────────
function itemFixtures(disabledKey: string) {
  const item = (origin: string, id: string, key: string) =>
    ({
      id,
      type: "ref",
      ref: origin,
      props: { id: key, ...(key === disabledKey ? { isDisabled: true } : {}) },
    }) as unknown as CanonicalNode;
  return [
    {
      origin: "component-tab-item-default",
      itemIds: ["tab-a", "tab-b"],
      ownerId: "tabs",
      nodes: [
        {
          id: "tabs",
          type: "Tabs",
          props: { defaultSelectedKey: "b" },
          children: [
            {
              id: "tabs__list",
              type: "TabList",
              props: {},
              children: [
                item("component-tab-item-default", "tab-a", "a"),
                item("component-tab-item-default", "tab-b", "b"),
              ],
            },
            { id: "tabs__panels", type: "TabPanels", props: {}, children: [] },
          ],
        } as unknown as CanonicalNode,
      ],
    },
    {
      origin: "component-listbox-item-default",
      itemIds: ["lb-a", "lb-b"],
      ownerId: "lb",
      nodes: [
        {
          id: "lb",
          type: "ListBox",
          props: { selectionMode: "single" },
          children: [
            item("component-listbox-item-default", "lb-a", "a"),
            item("component-listbox-item-default", "lb-b", "b"),
          ],
        } as unknown as CanonicalNode,
      ],
    },
    {
      origin: "component-gridlist-item-default",
      itemIds: ["gl-a", "gl-b"],
      ownerId: "gl",
      nodes: [
        {
          id: "gl",
          type: "GridList",
          props: { selectionMode: "single" },
          children: [
            item("component-gridlist-item-default", "gl-a", "a"),
            item("component-gridlist-item-default", "gl-b", "b"),
          ],
        } as unknown as CanonicalNode,
      ],
    },
    {
      origin: "component-tag-item-default",
      itemIds: ["tag-a", "tag-b"],
      ownerId: "tg",
      nodes: [
        {
          id: "tg",
          type: "TagGroup",
          props: { label: "T", selectionMode: "multiple" },
          children: [
            {
              id: "tg__list",
              type: "TagList",
              props: {},
              children: [
                item("component-tag-item-default", "tag-a", "a"),
                item("component-tag-item-default", "tag-b", "b"),
              ],
            },
          ],
        } as unknown as CanonicalNode,
      ],
    },
  ];
}

describe("ADR-237 G2 — 항목 `--disabled` 변형 편집은 disabled 항목에만 (Canvas · Preview)", () => {
  for (const fixture of itemFixtures("a")) {
    it(fixture.origin, () => {
      const doc = withUser(seedDocument(), fixture.nodes, {
        [`${fixture.origin}--disabled`]: { props: { style: { color: RED } } },
      });
      const [disabledId, restId] = fixture.itemIds as [string, string];
      const model = buildCanonicalSceneModel(doc);
      expect(sceneStyle(model, disabledId).color, "canvas disabled").toBe(RED);
      expect(sceneStyle(model, restId).color, "canvas rest").not.toBe(RED);
      const { container } = renderResolved(doc, fixture.ownerId);
      const styleOf = (id: string) =>
        container.querySelector<HTMLElement>(
          `[data-element-id="${id}"]:not([data-canonical-id])`,
        )?.style.color ??
        container.querySelector<HTMLElement>(
          `[data-element-id="${id}"][data-rac]`,
        )?.style.color;
      expect(styleOf(disabledId), "preview disabled").toBe(RED_RGB);
      expect(styleOf(restId), "preview rest").not.toBe(RED_RGB);
    });
  }
});

describe("ADR-237 G2 — 상호작용 변형은 Preview RAC render props 로만 (Canvas 는 그리지 않는다)", () => {
  it("Tab `--focus-visible` 편집: 키보드 포커스가 온 Tab 에만 · Canvas 는 변화 없음", () => {
    const [tabs] = itemFixtures("none");
    const doc = withUser(seedDocument(), tabs!.nodes, {
      "component-tab-item-default--focus-visible": {
        props: { style: { color: RED } },
      },
    });
    const model = buildCanonicalSceneModel(doc);
    expect(sceneStyle(model, "tab-a").color).not.toBe(RED);
    const { container } = renderResolved(doc, "tabs");
    const tab = (id: string) =>
      container.querySelector<HTMLElement>(
        `[data-element-id="${id}"][data-rac]`,
      )!;
    expect(tab("tab-b").style.color).not.toBe(RED_RGB);
    act(() => {
      fireEvent.keyDown(window.document.body, { key: "Tab" });
      tab("tab-b").focus();
    });
    expect(tab("tab-b").hasAttribute("data-focus-visible")).toBe(true);
    expect(tab("tab-b").style.color).toBe(RED_RGB);
    expect(tab("tab-a").style.color).not.toBe(RED_RGB);
  });

  it("MenuItem `--disabled` 편집: 열린 Menu 의 disabled 항목에만 (popover — Preview 전용, Canvas 는 trigger 만)", async () => {
    const doc = withUser(
      seedDocument(),
      [
        {
          id: "mn",
          type: "Menu",
          props: { label: "M", "aria-label": "M" },
          children: [
            {
              id: "mi-a",
              type: "ref",
              ref: "component-menu-item-default",
              props: { id: "a", isDisabled: true },
            },
            {
              id: "mi-b",
              type: "ref",
              ref: "component-menu-item-default",
              props: { id: "b" },
            },
          ],
        } as unknown as CanonicalNode,
      ],
      {
        "component-menu-item-default--disabled": {
          props: { style: { color: RED } },
        },
      },
    );
    const { container, baseElement } = renderResolved(doc, "mn");
    const trigger = container.querySelector("button")!;
    await act(async () => {
      fireEvent.pointerDown(trigger, { pointerType: "mouse" });
      fireEvent.pointerUp(trigger, { pointerType: "mouse" });
      fireEvent.click(trigger);
    });
    const item = (id: string) =>
      baseElement.querySelector<HTMLElement>(
        `.react-aria-MenuItem[data-element-id="${id}"]`,
      )!;
    expect(item("mi-a").hasAttribute("data-disabled")).toBe(true);
    expect(item("mi-a").style.color).toBe(RED_RGB);
    expect(item("mi-b").style.color).not.toBe(RED_RGB);
  });
});

// ── Disclosure 펼침 ─────────────────────────────────────────────────────────
function disclosureDoc(
  userChildren: CanonicalNode[],
  collapsedPatch: Record<string, unknown> = {
    props: { isExpanded: false, style: { color: RED } },
  },
): CompositionDocument {
  return withUser(seedDocument(), userChildren, {
    "component-disclosure--collapsed": collapsedPatch,
  });
}

function canvasExpanded(
  model: ReturnType<typeof buildCanonicalSceneModel>,
  id: string,
): boolean {
  const node = model.sceneNodesMap.get(id)!;
  const parentId = (node as { parent_id?: string | null }).parent_id ?? null;
  const parent = parentId ? model.sceneNodesMap.get(parentId) : undefined;
  const siblings =
    parent?.type === "DisclosureGroup"
      ? model.sceneChildrenByParent.get(parent.id)
      : undefined;
  return isDisclosureExpandedInContext(
    node as never,
    (parent ?? null) as never,
    siblings as never,
  );
}

function previewDisclosure(
  document: CompositionDocument,
  rootId: string,
  id: string,
) {
  const { container } = renderResolved(document, rootId);
  const el = container.querySelector<HTMLElement>(
    `.react-aria-Disclosure[data-element-id="${id}"]`,
  )!;
  const out = {
    expanded: el.hasAttribute("data-expanded"),
    color: el.style.color,
  };
  cleanup();
  return out;
}

describe("ADR-237 G2 — Disclosure 접힘 변형 왕복 (두 leg)", () => {
  it("origin 참조: 닫힘 → 펼침 → 닫힘 — 펼침 판정 (본문 · chevron reader) 과 접힘 층이 같이 바뀐다", () => {
    for (const [isExpanded, expectExpanded] of [
      [false, false],
      [true, true],
      [false, false],
    ] as const) {
      const doc = disclosureDoc([
        {
          id: "d1",
          type: "ref",
          ref: "component-disclosure",
          props: { isExpanded },
        } as unknown as CanonicalNode,
      ]);
      const model = buildCanonicalSceneModel(doc);
      expect(canvasExpanded(model, "d1"), `canvas ${isExpanded}`).toBe(
        expectExpanded,
      );
      expect(
        sceneStyle(model, "d1").color === RED,
        `canvas layer ${isExpanded}`,
      ).toBe(!expectExpanded);
      const preview = previewDisclosure(doc, "d1", "d1");
      expect(preview.expanded, `preview ${isExpanded}`).toBe(expectExpanded);
      expect(preview.color === RED_RGB, `preview layer ${isExpanded}`).toBe(
        !expectExpanded,
      );
    }
  });

  it("`--collapsed` 직접 참조: 기본 닫힘 · instance isExpanded:true 로 펼침 → 다시 닫힘 (본문 판정 두 leg)", () => {
    for (const [own, expectExpanded] of [
      [{}, false],
      [{ isExpanded: true }, true],
      [{ isExpanded: false }, false],
    ] as const) {
      const doc = disclosureDoc(
        [
          {
            id: "d2",
            type: "ref",
            ref: "component-disclosure--collapsed",
            props: own,
          } as unknown as CanonicalNode,
        ],
        { props: { isExpanded: false } },
      );
      const model = buildCanonicalSceneModel(doc);
      expect(canvasExpanded(model, "d2"), JSON.stringify(own)).toBe(
        expectExpanded,
      );
      expect(
        previewDisclosure(doc, "d2", "d2").expanded,
        JSON.stringify(own),
      ).toBe(expectExpanded);
    }
  });

  it("단일 펼침 그룹: 둘째 Disclosure 는 raw isExpanded:true 여도 접힘 층 (두 leg)", () => {
    const doc = disclosureDoc([
      {
        id: "dg",
        type: "DisclosureGroup",
        props: { allowsMultipleExpanded: false },
        children: [
          {
            id: "g1",
            type: "ref",
            ref: "component-disclosure",
            props: { isExpanded: true },
          },
          {
            id: "g2",
            type: "ref",
            ref: "component-disclosure",
            props: { isExpanded: true },
          },
        ] as unknown as CanonicalNode[],
      } as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc);
    expect(canvasExpanded(model, "g1")).toBe(true);
    expect(canvasExpanded(model, "g2")).toBe(false);
    expect(sceneStyle(model, "g1").color).not.toBe(RED);
    expect(sceneStyle(model, "g2").color).toBe(RED);
    const { container } = renderResolved(doc, "dg");
    const el = (id: string) =>
      container.querySelector<HTMLElement>(
        `.react-aria-Disclosure[data-element-id="${id}"]`,
      )!;
    expect(el("g1").hasAttribute("data-expanded")).toBe(true);
    expect(el("g2").hasAttribute("data-expanded")).toBe(false);
    expect(el("g1").style.color).not.toBe(RED_RGB);
    expect(el("g2").style.color).toBe(RED_RGB);
  });

  it("instance 그룹 (origin 에서 상속한 합성 Disclosure) — 단일 펼침이면 둘째만 접힘 층 · 여러 펼침이면 둘 다 펼침 (Canvas 위치 후처리)", () => {
    for (const [allows, secondCollapsed] of [
      [false, true],
      [true, false],
    ] as const) {
      const doc = disclosureDoc([
        {
          id: "dg-inst",
          type: "ref",
          ref: "component-disclosuregroup",
          props: { allowsMultipleExpanded: allows },
        } as unknown as CanonicalNode,
      ]);
      const model = buildCanonicalSceneModel(doc);
      const [first, second] = model.sceneChildrenByParent.get("dg-inst") ?? [];
      expect(first?.type).toBe("Disclosure");
      expect(canvasExpanded(model, first!.id), `first ${allows}`).toBe(true);
      expect(canvasExpanded(model, second!.id), `second ${allows}`).toBe(
        !secondCollapsed,
      );
      expect(
        sceneStyle(model, first!.id).color,
        `first layer ${allows}`,
      ).not.toBe(RED);
      expect(
        sceneStyle(model, second!.id).color === RED,
        `second layer ${allows}`,
      ).toBe(secondCollapsed);
    }
  });

  it("접힘 변형의 구조 patch (`enabled`) 는 층에서 빠진다 — 접힌 instance 도 본문 자식을 잃지 않는다 (두 leg)", () => {
    const doc = disclosureDoc(
      [
        {
          id: "d3",
          type: "ref",
          ref: "component-disclosure",
          props: { isExpanded: false },
        } as unknown as CanonicalNode,
      ],
      {
        props: { isExpanded: false },
        enabled: false,
        descendants: { "component-disclosure__2": { enabled: false } },
      },
    );
    const set = buildStateLayerSet("component-disclosure", (id) =>
      find(doc.children, id),
    );
    expect(set?.layers.collapsed).toEqual({ props: { isExpanded: false } });
    const model = buildCanonicalSceneModel(doc);
    expect(model.sceneNodesMap.has("d3")).toBe(true);
    expect(
      (model.sceneChildrenByParent.get("d3") ?? []).map((c) => c.type),
    ).toContain("DisclosureContent");
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "d3",
    )!;
    expect((resolved.children ?? []).map((c) => c.type)).toContain(
      "DisclosureContent",
    );
  });
});

describe("ADR-237 G2 — 234 층 순서 계승", () => {
  it("접힘 층은 맨 앞 · 현재 (Phase 3) 는 selected 뒤 · 나머지 234 순서 그대로", () => {
    expect(STATE_LAYER_ORDER).toEqual([
      "collapsed",
      "unselected",
      "selected",
      "current",
      "focus-visible",
      "hover",
      "pressed",
      "disabled",
    ]);
  });

  it("Components body 는 seed 뒤에도 하나 (변형은 body 직계)", () => {
    const doc = seedDocument();
    const body = find(doc.children, COMPONENTS_SYSTEM_BODY_ID)!;
    expect(
      (body.children ?? []).filter(
        (n) => n.id === "component-disclosure--collapsed",
      ),
    ).toHaveLength(1);
  });
});
