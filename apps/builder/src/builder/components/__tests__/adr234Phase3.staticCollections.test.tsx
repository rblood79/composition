import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import {
  isStaticCollectionOwner,
  migrateStaticCollectionsToInstances,
} from "../staticCollectionMigration";
import { planTabItemInsert } from "../collectionItemInsert";
import { resolveSlotInsertAction } from "../slotHostPolicy";

/**
 * ADR-234 Phase 3 — 목록 = slot 을 채운 instance 자식 (Tabs, breakdown §4 Phase 3).
 *
 * - 이관: 정적 `items` → TabList 의 Tab instance 자식 (`props.id` = 행 id · label = descendants) · slot 은
 *   TabList 로 · 바인딩 목록 무변경 · instance 의 `items` override → descendants mode C · 멱등.
 * - Canvas: TabList 아래 실제 Tab 노드 · 선택 = Tabs key (origin `_isSelected` 상속보다 먼저) · scene
 *   자식 목록과 map 이 같은 해석 결과.
 * - Preview: RAC static children (`<TabList><Tab id>`) · TabPanel `itemId` 짝.
 * - Slot "+": plain = Tab + TabPanel 자식 · instance = descendants mode C.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findById(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
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

function seededDoc(user: CanonicalNode[] = []): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [
          {
            id: "body-home",
            type: "body" as CanonicalNode["type"],
            children: user,
          },
        ],
      },
    ],
  } as CompositionDocument);
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

const tabsInstance = {
  id: "tabs-1",
  type: "ref",
  ref: "component-tabs",
  props: {},
} as unknown as CanonicalNode;

describe("ADR-234 Phase 3 — Tabs 이관", () => {
  it("origin: TabList 에 Tab instance 자식 (id = TabPanel itemId · label descendants) · items 0 · slot 은 TabList", () => {
    const doc = seededDoc();
    const tabs = findById(doc.children, "component-tabs")!;
    const tabList = tabs.children!.find((c) => c.type === "TabList")!;
    const panels = tabs.children!.find((c) => c.type === "TabPanels")!;
    expect(tabs.props?.items).toBeUndefined();
    expect(tabList.props?.items).toBeUndefined();
    expect(tabs.slot).toBeUndefined();
    expect(tabList.slot).toEqual([
      "component-tab-item-default--unselected",
      "component-tab-item-default",
    ]);
    const children = tabList.children ?? [];
    expect(children.map((c) => (c as { ref?: string }).ref)).toEqual([
      "component-tab-item-default",
      "component-tab-item-default",
    ]);
    expect(children.map((c) => c.props?.id)).toEqual(
      panels.children!.map((p) => p.props?.itemId),
    );
    expect(
      children.map(
        (c) =>
          (c as { descendants?: Record<string, { children?: unknown }> })
            .descendants?.Label?.children,
      ),
    ).toEqual(["Tab 1", "Tab 2"]);
    // Tabs 의 기본 선택은 첫 Tab key 그대로
    expect(tabs.props?.defaultSelectedKey).toBe(children[0]!.props?.id);
  });

  it("재hydration 멱등", () => {
    const once = seededDoc([tabsInstance]);
    expect(JSON.stringify(ensureReusableCompositeOrigins(once))).toBe(
      JSON.stringify(once),
    );
  });

  it("문서의 plain Tabs (정적 items) 는 자식으로, 바인딩 Tabs 는 그대로", () => {
    const plain = {
      id: "plain-tabs",
      type: "Tabs",
      props: { items: [{ id: "a", title: "Alpha" }], defaultSelectedKey: "a" },
      children: [
        { id: "plain-list", type: "TabList", props: {} },
        {
          id: "plain-panels",
          type: "TabPanels",
          props: {},
          children: [{ id: "p-a", type: "TabPanel", props: { itemId: "a" } }],
        },
      ],
    } as CanonicalNode;
    const bound = {
      ...plain,
      id: "bound-tabs",
      props: { ...plain.props, dataBinding: { source: "x", name: "y" } },
      children: [
        { id: "bound-list", type: "TabList", props: {} },
        { id: "bound-panels", type: "TabPanels", props: {} },
      ],
    } as CanonicalNode;
    const doc = seededDoc([plain, bound]);
    const list = findById(doc.children, "plain-list")!;
    expect(list.children?.map((c) => c.props?.id)).toEqual(["a"]);
    expect(findById(doc.children, "plain-tabs")!.props?.items).toBeUndefined();
    expect(findById(doc.children, "bound-tabs")!.props?.items).toEqual([
      { id: "a", title: "Alpha" },
    ]);
    expect(findById(doc.children, "bound-list")!.children).toBeUndefined();
  });

  it("instance 의 items override → TabList 경로 descendants mode C", () => {
    const doc = seededDoc([
      {
        ...tabsInstance,
        props: { items: [{ id: "x", title: "X" }] },
      } as unknown as CanonicalNode,
    ]);
    const instance = findById(doc.children, "tabs-1") as unknown as {
      props: Record<string, unknown>;
      descendants: Record<string, { children: CanonicalNode[] }>;
    };
    expect(instance.props.items).toBeUndefined();
    const children = instance.descendants["component-tabs__1"]!.children;
    expect(children.map((c) => c.props?.id)).toEqual(["x"]);
    // 이관 결과를 다시 돌려도 같은 객체
    expect(migrateStaticCollectionsToInstances(doc)).toBe(doc);
  });
});

describe("ADR-234 Phase 3 — Tabs 두 leg", () => {
  it("Canvas: instance · origin 모두 선택 key 의 Tab 만 선택 (scene 자식 목록 = map)", () => {
    const doc = seededDoc([tabsInstance]);
    const model = buildCanonicalSceneModel(doc);
    for (const listId of ["tabs-1/component-tabs__1", "component-tabs__1"]) {
      const tabs = model.sceneChildrenByParent.get(listId) ?? [];
      expect(tabs.map((t) => t.type)).toEqual(["Tab", "Tab"]);
      expect(
        tabs.map((t) => (t.props as Record<string, unknown>)._isSelected),
      ).toEqual([true, undefined]);
      for (const tab of tabs) {
        expect(model.sceneNodesMap.get(tab.id)).toBe(tab);
      }
      // label = descendants (template `{label}` 가 아니다)
      const labels = tabs.map(
        (t) =>
          (
            model.sceneChildrenByParent.get(t.id)?.[0]?.props as Record<
              string,
              unknown
            >
          )?.children,
      );
      expect(labels).toEqual(["Tab 1", "Tab 2"]);
    }
    // items projection (tab-rows) 은 만들지 않는다
    expect(
      [...model.sceneNodesMap.keys()].some((id) => id.includes("tab-rows")),
    ).toBe(false);
  });

  it("Preview: RAC static Tab 2 · 선택 1 · 선택 Tab 의 TabPanel", () => {
    const doc = seededDoc([tabsInstance]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "tabs-1",
    )!;
    const { container } = renderResolved(resolved);
    const tabs = Array.from(container.querySelectorAll(".react-aria-Tab"));
    expect(tabs.map((t) => t.textContent)).toEqual(["Tab 1", "Tab 2"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
    ]);
    expect(container.querySelectorAll(".react-aria-TabPanel").length).toBe(1);
  });
});

describe("ADR-234 Phase 3 — Slot +", () => {
  it("TabList 가 slot host — 삽입 행동 = tab-item", () => {
    const doc = seededDoc();
    const tabList = findById(doc.children, "component-tabs__1")!;
    expect(
      resolveSlotInsertAction(
        tabList as unknown as Parameters<typeof resolveSlotInsertAction>[0],
        findById(
          doc.children,
          "component-tab-item-default--unselected",
        ) as unknown as Parameters<typeof resolveSlotInsertAction>[1],
      ),
    ).toEqual({ kind: "list-item" });
  });

  it("plain: Tab instance (항목 origin 을 가리킴) + 짝 TabPanel", () => {
    const doc = seededDoc();
    const plan = planTabItemInsert({
      document: doc,
      hostId: "component-tabs__1",
      candidateId: "component-tab-item-default--unselected",
      newKey: "k3",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: "component-tabs__1",
      tab: {
        id: "component-tabs__1__tab-3",
        type: "ref",
        ref: "component-tab-item-default",
        props: { id: "k3" },
        descendants: { Label: { children: "Tab 3" } },
      },
      tabPanelsId: "component-tabs__2",
      panel: { type: "TabPanel", props: { itemId: "k3" } },
    });
  });

  it("instance: descendants mode C 로 origin 목록 복제 + 새 Tab · TabPanel — 두 leg 가 3 Tab 을 그린다", () => {
    const doc = seededDoc([tabsInstance]);
    const plan = planTabItemInsert({
      document: doc,
      hostId: "tabs-1/component-tabs__1",
      candidateId: "component-tab-item-default",
      newKey: "k3",
    });
    expect(plan?.kind).toBe("instance");
    if (plan?.kind !== "instance") return;
    const next = {
      ...doc,
      children: doc.children.map((page) =>
        page.id !== "page-home"
          ? page
          : {
              ...page,
              children: [
                {
                  ...page.children![0]!,
                  children: [
                    { ...tabsInstance, descendants: plan.descendants },
                  ],
                },
              ],
            },
      ),
    } as CompositionDocument;
    const model = buildCanonicalSceneModel(next);
    const sceneTabs =
      model.sceneChildrenByParent.get("tabs-1/component-tabs__1") ?? [];
    expect(sceneTabs.map((t) => t.type)).toEqual(["Tab", "Tab", "Tab"]);
    // mode C 로 채운 Tab 도 실행 중 상태 층 (선택 = Tabs key) 을 받는다.
    expect(
      sceneTabs.map((t) => (t.props as Record<string, unknown>)._isSelected),
    ).toEqual([true, undefined, undefined]);
    const resolved = findResolved(
      resolveCanonicalDocument(next) as ResolvedNode[],
      "tabs-1",
    )!;
    const { container } = renderResolved(resolved);
    expect(
      Array.from(container.querySelectorAll(".react-aria-Tab")).map(
        (t) => t.textContent,
      ),
    ).toEqual(["Tab 1", "Tab 2", "Tab 3"]);
  });
});

describe("ADR-234 Phase 3 — layout · 템플릿 slot · descendants 키", () => {
  it("layout: 정적 Tab 자식만 있는 Tabs 는 빈 목록이 아니다 (TabPanels 를 layout 에 싣는다)", async () => {
    const { applyImplicitStyles } = await import(
      "../../workspace/canvas/layout/engines/implicitStyles"
    );
    const node = (
      id: string,
      type: string,
      parent: string | null,
      props: Record<string, unknown> = {},
    ) => ({ id, type, parent_id: parent, props });
    const tabs = node("tabs", "Tabs", null, { defaultSelectedKey: "a" });
    const tabList = node("list", "TabList", "tabs");
    const panels = node("panels", "TabPanels", "tabs");
    const tabA = node("tab-a", "Tab", "list", { id: "a" });
    const panelA = node("panel-a", "TabPanel", "panels", { itemId: "a" });
    const all = [tabs, tabList, panels, tabA, panelA];
    const byId = new Map(all.map((n) => [n.id, n]));
    const childrenOf = (id: string) => all.filter((n) => n.parent_id === id);
    const tabsResult = applyImplicitStyles(
      tabs,
      childrenOf("tabs"),
      childrenOf,
      byId,
    );
    expect(tabsResult.filteredChildren.map((c) => c.id)).toEqual([
      "list",
      "panels",
    ]);
    expect(
      (tabsResult.filteredChildren[0]!.props.style as Record<string, unknown>)
        .height,
    ).toBeGreaterThan(0);
    const panelsResult = applyImplicitStyles(
      panels,
      childrenOf("panels"),
      childrenOf,
      byId,
    );
    expect(panelsResult.filteredChildren.map((c) => c.id)).toEqual([
      "panel-a",
    ]);
  });

  it("bound Tabs 템플릿: slot 을 TabList 에서 읽는다 (두 leg)", async () => {
    const { resolveTabTemplateOriginIds } = await import(
      "../../workspace/canvas/scene/canvasSceneNode"
    );
    const { readTabsTemplateSlot } = await import(
      "../../../preview/utils/itemTemplates"
    );
    const doc = seededDoc();
    const byId = new Map<string, CanonicalNode>();
    const walk = (nodes: readonly CanonicalNode[]) => {
      for (const n of nodes) {
        byId.set(n.id, n);
        walk(n.children ?? []);
      }
    };
    walk(doc.children);
    const tabs = byId.get("component-tabs")!;
    expect(resolveTabTemplateOriginIds(tabs, () => byId, null)).toEqual({
      defaultOriginId: "component-tab-item-default--unselected",
      selectedOriginId: "component-tab-item-default",
    });
    expect(readTabsTemplateSlot(tabs)).toEqual([
      "component-tab-item-default--unselected",
      "component-tab-item-default",
    ]);
  });

  it("Phase 2 이관 descendants 키 = segment 경로 — 휴지 변형의 label 차이가 Canvas 에도 닿는다", async () => {
    const { ensureReusableCompositeOriginsBeforeVariantMigration } =
      await import("../reusableCompositeOrigins");
    const { migrateVariantsToOriginInstances } = await import(
      "../stateVariantMigration"
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = ensureReusableCompositeOriginsBeforeVariantMigration({
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
        },
      ],
    } as CompositionDocument);
    // selected Tag 의 label 만 빨강 — 휴지 (default) 는 색 없음.
    const paint = (nodes: CanonicalNode[]): CanonicalNode[] =>
      nodes.map((n) =>
        n.id === "component-tag-item-selected__label"
          ? { ...n, props: { ...n.props, style: { color: "#ff0000" } } }
          : n.children
            ? { ...n, children: paint(n.children) }
            : n,
      );
    const after = migrateVariantsToOriginInstances({
      ...before,
      children: paint(before.children),
    });
    const unselected = findById(
      after.children,
      "component-tag-item-default--unselected",
    ) as unknown as { descendants?: Record<string, unknown> };
    expect(Object.keys(unselected.descendants ?? {})).toContain("Label");
    const model = buildCanonicalSceneModel(after);
    const label = (
      model.sceneChildrenByParent.get(
        "component-tag-item-default--unselected",
      ) ?? []
    ).find((c) => c.id.endsWith("/Label"));
    expect(
      (label?.props.style as Record<string, unknown> | undefined)?.color,
    ).toBeUndefined();
    const originLabel = (
      model.sceneChildrenByParent.get("component-tag-item-default") ?? []
    ).find((c) => c.id === "component-tag-item-default__label");
    expect(
      (originLabel?.props.style as Record<string, unknown> | undefined)?.color,
    ).toBe("#ff0000");
  });
});

describe("ADR-234 Phase 3 — Skia 페인트 재해석", () => {
  it("해석된 scene 노드를 페인트 경로가 다시 해석해도 층 · ref 자기 null 이 지운 키가 되살아나지 않는다", async () => {
    const { resolveCanonicalRefElement } = await import(
      "../../../adapters/canonical/canonicalRefResolution"
    );
    const doc = seededDoc([tabsInstance]);
    const model = buildCanonicalSceneModel(doc);
    const map = model.sceneNodesMap;
    for (const id of [
      "component-tabs__1__tab-2",
      "tabs-1/component-tabs__1/component-tabs__1__tab-2",
      "component-tab-item-default--unselected",
    ]) {
      const node = map.get(id)!;
      expect((node.props as Record<string, unknown>)._isSelected, id).toBe(
        undefined,
      );
      // StoreRenderBridge.buildNodeForElement 와 같은 호출.
      const ref = (node as { ref?: string }).ref;
      const repainted = resolveCanonicalRefElement(
        node,
        map.values(),
        ref ? map.get(ref) : undefined,
      );
      expect(
        (repainted.props as Record<string, unknown>)._isSelected,
        id,
      ).toBe(undefined);
    }
  });
});

describe("ADR-234 Phase 3b — TagGroup", () => {
  const tagGroupInstance = {
    id: "tg-1",
    type: "ref",
    ref: "component-taggroup",
    props: {},
  } as unknown as CanonicalNode;

  it("이관: TagList 에 Tag instance 자식 (label · leading slot 은 행 값 없으면 enabled:false) · items 0 · slot 은 TagList · 멱등", () => {
    const doc = seededDoc([tagGroupInstance]);
    const tg = findById(doc.children, "component-taggroup")!;
    const tagList = tg.children!.find((c) => c.type === "TagList")!;
    expect(tg.props?.items).toBeUndefined();
    expect(tagList.props?.items).toBeUndefined();
    expect(tg.slot).toBeUndefined();
    expect(tagList.slot).toEqual([
      "component-tag-item-default--unselected",
      "component-tag-item-default",
    ]);
    const tags = tagList.children ?? [];
    expect(tags).toHaveLength(4);
    expect(tags[0]).toMatchObject({
      type: "ref",
      ref: "component-tag-item-default",
      descendants: {
        Label: { children: "Chocolate" },
        Icon: { enabled: false },
        Avatar: { enabled: false },
      },
    });
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("행의 icon 은 Icon descendants 로 · 바인딩 TagGroup 은 그대로", () => {
    const plain = {
      id: "plain-tg",
      type: "TagGroup",
      props: { items: [{ id: "a", label: "Alpha", icon: "star" }] },
      children: [{ id: "plain-tl", type: "TagList", props: {} }],
    } as CanonicalNode;
    const bound = {
      id: "bound-tg",
      type: "TagGroup",
      props: {
        items: [{ id: "a", label: "Alpha" }],
        dataBinding: { source: "x", name: "y" },
      },
      children: [{ id: "bound-tl", type: "TagList", props: {} }],
    } as CanonicalNode;
    const doc = seededDoc([plain, bound]);
    const tag = findById(doc.children, "plain-tl")!.children![0] as unknown as {
      props: Record<string, unknown>;
      descendants: Record<string, unknown>;
    };
    expect(tag.props.id).toBe("a");
    expect(tag.descendants.Icon).toEqual({ iconName: "star" });
    expect(findById(doc.children, "bound-tg")!.props?.items).toHaveLength(1);
    expect(findById(doc.children, "bound-tl")!.children).toBeUndefined();
  });

  it("Canvas: 선택 = TagGroup selectedKeys (origin `_isSelected` 상속보다 먼저) · Icon/Avatar 숨김", () => {
    const base = seededDoc([tagGroupInstance]);
    const firstKey = String(
      findById(base.children, "component-taggroup__2")!.children![1]!.props
        ?.id,
    );
    const doc = seededDoc([
      {
        ...tagGroupInstance,
        props: { selectedKeys: [firstKey] },
      } as unknown as CanonicalNode,
    ]);
    // 같은 seed 라도 item id 는 문서마다 새로 — 이 문서의 두 번째 Tag key 로 다시.
    const key = String(
      findById(doc.children, "component-taggroup__2")!.children![1]!.props?.id,
    );
    const docSelected = {
      ...doc,
      children: doc.children.map((page) =>
        page.id !== "page-home"
          ? page
          : {
              ...page,
              children: [
                {
                  ...page.children![0]!,
                  children: [
                    {
                      ...tagGroupInstance,
                      props: { selectedKeys: [key] },
                    } as unknown as CanonicalNode,
                  ],
                },
              ],
            },
      ),
    } as CompositionDocument;
    const model = buildCanonicalSceneModel(docSelected);
    const tags =
      model.sceneChildrenByParent.get("tg-1/component-taggroup__2") ?? [];
    expect(
      tags.map((t) => (t.props as Record<string, unknown>)._isSelected),
    ).toEqual([undefined, true, undefined, undefined]);
    expect(
      (model.sceneChildrenByParent.get(tags[0]!.id) ?? []).map((c) => c.type),
    ).toEqual(["Text"]);
  });

  it("Preview: RAC static Tag 4 (maxRows 미러 제외) · 글자 = label descendants", () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const doc = seededDoc([tagGroupInstance]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "tg-1",
    )!;
    const { container } = renderResolved(resolved);
    const tags = Array.from(
      container.querySelectorAll('.react-aria-Tag[role="row"]'),
    );
    expect(tags.map((t) => t.textContent)).toEqual([
      "Chocolate",
      "Mint",
      "Strawberry",
      "Vanilla",
    ]);
  });

  it("Slot +: TagList host → Tag instance (패널 없음)", () => {
    const doc = seededDoc();
    const tagList = findById(doc.children, "component-taggroup__2")!;
    expect(
      resolveSlotInsertAction(
        tagList as unknown as Parameters<typeof resolveSlotInsertAction>[0],
        findById(
          doc.children,
          "component-tag-item-default",
        ) as unknown as Parameters<typeof resolveSlotInsertAction>[1],
      ),
    ).toEqual({ kind: "list-item" });
    const plan = planTabItemInsert({
      document: doc,
      hostId: "component-taggroup__2",
      candidateId: "component-tag-item-default--unselected",
      newKey: "k5",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: "component-taggroup__2",
      tab: {
        id: "component-taggroup__2__tag-5",
        ref: "component-tag-item-default",
        props: { id: "k5" },
        descendants: { Label: { children: "Tag 5" } },
      },
      tabPanelsId: null,
      panel: null,
    });
  });
});

describe("ADR-234 Phase 3 — items 편집기는 바인딩 목록 전용", () => {
  it("정적 목록 owner (origin · instance) 는 true, 바인딩 · 이관 전 목록은 false", () => {
    const bound = {
      id: "bound-tg",
      type: "TagGroup",
      props: {
        items: [{ id: "a", label: "A" }],
        dataBinding: { source: "x", name: "y" },
      },
      children: [{ id: "bound-tl", type: "TagList", props: {} }],
    } as CanonicalNode;
    const doc = seededDoc([
      { id: "tg-1", type: "ref", ref: "component-taggroup", props: {} } as unknown as CanonicalNode,
      tabsInstance,
      bound,
    ]);
    expect(isStaticCollectionOwner(doc, "component-taggroup")).toBe(true);
    expect(isStaticCollectionOwner(doc, "tg-1")).toBe(true);
    expect(isStaticCollectionOwner(doc, "tabs-1")).toBe(true);
    expect(isStaticCollectionOwner(doc, "bound-tg")).toBe(false);
    expect(isStaticCollectionOwner(doc, "component-listbox")).toBe(false);
  });
});
