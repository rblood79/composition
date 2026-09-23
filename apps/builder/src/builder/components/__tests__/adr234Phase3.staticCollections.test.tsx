import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
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
  // production 정규화 순서 (`normalizeMainDocument`): MenuItem origin 을 먼저 싣고 이관한다.
  return ensureReusableCompositeOrigins(ensureMenuTemplateOrigins({
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
  } as CompositionDocument));
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
    // Skia 입력 (`rendererInput` projection index) 은 모든 scene 노드의 sourceNode 를 읽는다 — mode C 자식도.
    expect(
      [...model.sceneNodesMap.values()]
        .filter((n) => n.id.startsWith("tabs-1/"))
        .every((n) => (n as { sourceNode?: unknown }).sourceNode != null),
    ).toBe(true);
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
    // maxRows 「Show all」 chip (origin 기본 maxRows 2) 은 항목이 아니다.
    const tags = (
      model.sceneChildrenByParent.get("tg-1/component-taggroup__2") ?? []
    ).filter((t) => !(t.props as Record<string, unknown>)._isShowAll);
    expect(
      tags.map((t) => (t.props as Record<string, unknown>)._isSelected),
    ).toEqual([undefined, true, undefined, undefined]);
    expect(
      (model.sceneChildrenByParent.get(tags[0]!.id) ?? []).map((c) => c.type),
    ).toEqual(["Text"]);
  });

  it("Canvas: maxRows → 정적 TagList 끝에 Show all chip (instance override 우선 · 숨긴 Tag 제외) · 0 이면 없음", () => {
    const showAllOf = (model: ReturnType<typeof buildCanonicalSceneModel>, listId: string) =>
      (model.sceneChildrenByParent.get(listId) ?? []).filter(
        (c) => (c.props as Record<string, unknown>)._isShowAll === true,
      );
    // origin 기본 maxRows 2 — origin · instance 모두 Show all 1 (글자 = 정적 Tag 수).
    const doc = seededDoc([tagGroupInstance]);
    const model = buildCanonicalSceneModel(doc);
    for (const listId of ["component-taggroup__2", "tg-1/component-taggroup__2"]) {
      const chips = showAllOf(model, listId);
      expect(chips, listId).toHaveLength(1);
      expect((chips[0]!.props as Record<string, unknown>).children).toBe("Show all (4)");
      expect(chips[0]!.type).toBe("Tag");
      const siblings = model.sceneChildrenByParent.get(listId) ?? [];
      expect(siblings[siblings.length - 1]!.id).toBe(chips[0]!.id);
    }
    // instance maxRows 0 → instance 목록에는 없음 (origin 은 그대로).
    const off = buildCanonicalSceneModel(
      seededDoc([{ ...tagGroupInstance, props: { maxRows: 0 } } as unknown as CanonicalNode]),
    );
    expect(showAllOf(off, "tg-1/component-taggroup__2")).toHaveLength(0);
    expect(showAllOf(off, "component-taggroup__2")).toHaveLength(1);
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
    // ListBox (3d) · GridList (3e) 도 정적 목록 (자기 자식 = 항목 instance).
    expect(isStaticCollectionOwner(doc, "component-listbox")).toBe(true);
    expect(isStaticCollectionOwner(doc, "component-gridlist")).toBe(true);
  });
});

describe("ADR-234 Phase 3c — 항목 label 은 항목 글자 상속 (Canvas resolver)", () => {
  it("Tab label: md 14 · 500 · 줄 21 · 비선택 muted / 선택 neutral · owner size 따라감 · 작성자 값 우선", async () => {
    const { resolveItemLabelTypography, applyItemLabelTypography } =
      await import("../../workspace/canvas/skia/itemLabelInheritance");
    const map = new Map<
      string,
      { type: string; props?: Record<string, unknown>; parent_id?: string }
    >([
      ["tabs", { type: "Tabs", props: {} }],
      ["list", { type: "TabList", props: {}, parent_id: "tabs" }],
      ["t1", { type: "Tab", props: { _isSelected: true }, parent_id: "list" }],
      ["t2", { type: "Tab", props: {}, parent_id: "list" }],
      ["l1", { type: "Text", props: {}, parent_id: "t1" }],
      ["l2", { type: "Text", props: {}, parent_id: "t2" }],
      ["tg", { type: "TagGroup", props: { size: "lg" } }],
      ["tl", { type: "TagList", props: {}, parent_id: "tg" }],
      ["g1", { type: "Tag", props: { _isSelected: true }, parent_id: "tl" }],
      ["gl", { type: "Text", props: {}, parent_id: "g1" }],
      ["g2", { type: "Tag", props: {}, parent_id: "tl" }],
      ["gl2", { type: "Text", props: {}, parent_id: "g2" }],
      ["gi", { type: "Icon", props: { slot: "icon" }, parent_id: "g1" }],
      ["gi2", { type: "Icon", props: { slot: "icon" }, parent_id: "g2" }],
      ["plain", { type: "Text", props: {}, parent_id: "tabs" }],
    ]);
    const sel = resolveItemLabelTypography(map.get("l1")!, map)!;
    const idle = resolveItemLabelTypography(map.get("l2")!, map)!;
    expect(sel).toMatchObject({
      fontSize: 14,
      fontWeight: 500,
      lineHeight: "21px",
      color: "{color.neutral}",
    });
    expect(idle.color).toBe("{color.neutral-subdued}");
    const tag = resolveItemLabelTypography(map.get("gl")!, map)!;
    expect(tag.fontSize).toBe(16);
    // 선택 Tag chip 은 rule selected 변형 (accent 배경) — label 은 on-accent (DOM `[data-selected]` 와 같다).
    expect(tag.color).toBe("{color.on-accent}");
    expect(resolveItemLabelTypography(map.get("gl2")!, map)!.color).toBe(
      "{color.neutral}",
    );
    // leading icon 은 chip 글자색 (`.tag-leading-icon { color: inherit }`).
    expect(resolveItemLabelTypography(map.get("gi")!, map)).toEqual({
      fontSize: 14,
      color: "{color.on-accent}",
    });
    expect(resolveItemLabelTypography(map.get("gi2")!, map)!.color).toBe(
      "{color.neutral}",
    );
    expect(resolveItemLabelTypography(map.get("plain")!, map)).toBeNull();
    expect(
      applyItemLabelTypography({ color: "#f00", fontSize: 20 }, sel),
    ).toMatchObject({ color: "#f00", fontSize: 20, fontWeight: 500 });
  });
});

describe("ADR-234 Phase 3c — 배선 (static)", () => {
  it("Skia · layout 이 같은 resolver 를 읽고, DOM CSS 가 Tab · Tag 안 Text 상속을 되살린다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../../..");
    const read = (p: string) => fs.readFileSync(path.resolve(root, p), "utf8");
    for (const file of [
      "builder/workspace/canvas/skia/buildSpecNodeData.ts",
      "builder/workspace/canvas/layout/engines/fullTreeLayout.ts",
    ]) {
      expect(read(file), file).toMatch(/resolveItemLabelTypography\(/);
    }
    const css = path.resolve(root, "../../../packages/shared/src/components/styles");
    expect(fs.readFileSync(`${css}/TabsIndicator.css`, "utf8")).toMatch(
      /\.react-aria-Tab \.react-aria-Text\.react-aria-Text \{[^}]*font-size: inherit/,
    );
    expect(fs.readFileSync(`${css}/TagGroup.css`, "utf8")).toMatch(
      /\.react-aria-Tag \.react-aria-Text\.react-aria-Text \{[^}]*color: inherit/,
    );
  });
});

describe("ADR-234 Phase 3d — ListBox (목록 틀 = owner)", () => {
  const listBoxInstance = {
    id: "lb-1",
    type: "ref",
    ref: "component-listbox",
    props: {},
  } as unknown as CanonicalNode;

  function withUser(doc: CompositionDocument, user: CanonicalNode[]) {
    return {
      ...doc,
      children: doc.children.map((page) =>
        page.id !== "page-home"
          ? page
          : {
              ...page,
              children: [{ ...page.children![0]!, children: user }],
            },
      ),
    } as CompositionDocument;
  }

  function stubResizeObserver() {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  it("이관: ListBox 자식 = ListBoxItem instance (key · icon/label/description descendants) · items 0 · slot 은 ListBox · 멱등", () => {
    const doc = seededDoc([listBoxInstance]);
    const lb = findById(doc.children, "component-listbox")!;
    expect(lb.props?.items).toBeUndefined();
    expect(lb.slot).toEqual([
      "component-listbox-item-default--unselected",
      "component-listbox-item-default",
    ]);
    expect(lb.children).toHaveLength(3);
    expect(lb.children![0]).toMatchObject({
      type: "ref",
      ref: "component-listbox-item-default",
      props: { id: "inbox" },
      descendants: {
        Icon: { iconName: "inbox" },
        Label: { children: "Inbox" },
        Description: { children: "Unread messages" },
      },
    });
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
    // 행에 없는 slot 은 숨김 · section 행은 이관하지 않는다.
    const plain = {
      id: "plain-lb",
      type: "ListBox",
      props: { items: [{ id: "a", label: "Alpha" }] },
    } as CanonicalNode;
    const sectioned = {
      id: "sec-lb",
      type: "ListBox",
      props: {
        items: [{ id: "s", type: "section", header: "S", items: [] }],
      },
    } as CanonicalNode;
    const doc2 = seededDoc([plain, sectioned]);
    expect(findById(doc2.children, "plain-lb")!.children![0]).toMatchObject({
      props: { id: "a" },
      descendants: {
        Icon: { enabled: false },
        Label: { children: "Alpha" },
        Description: { enabled: false },
      },
    });
    expect(findById(doc2.children, "sec-lb")!.props?.items).toHaveLength(1);
  });

  it("instance 의 items override → origin 항목 숨김 (enabled:false) + instance 자기 자식 · items 0", () => {
    const doc = seededDoc([
      {
        ...listBoxInstance,
        props: { items: [{ id: "x", label: "Xray" }] },
      } as unknown as CanonicalNode,
    ]);
    const inst = findById(doc.children, "lb-1") as unknown as {
      props: Record<string, unknown>;
      descendants: Record<string, unknown>;
      children: CanonicalNode[];
    };
    expect(inst.props.items).toBeUndefined();
    expect(Object.values(inst.descendants)).toEqual([
      { enabled: false },
      { enabled: false },
      { enabled: false },
    ]);
    expect(inst.children).toHaveLength(1);
    expect(inst.children[0]).toMatchObject({
      ref: "component-listbox-item-default",
      props: { id: "x" },
    });
    // 두 leg: Canvas scene · Preview resolved 모두 Xray 하나.
    const model = buildCanonicalSceneModel(doc);
    const items = model.sceneChildrenByParent.get("lb-1") ?? [];
    expect(items.map((i) => (i.props as Record<string, unknown>).id)).toEqual([
      "x",
    ]);
    stubResizeObserver();
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "lb-1",
    )!;
    const { container } = renderResolved(resolved);
    expect(
      Array.from(container.querySelectorAll('[role="option"]')).map((o) =>
        o.getAttribute("data-key"),
      ),
    ).toEqual(["x"]);
  });

  it("바인딩 instance 는 origin 의 정적 항목을 싣지 않는다 (ListBox · TagGroup — 두 leg)", () => {
    const binding = { source: "dataTable", name: "dt" };
    const insts = [
      { id: "lb-b", type: "ref", ref: "component-listbox", props: { dataBinding: binding } },
      { id: "tg-b", type: "ref", ref: "component-taggroup", props: { dataBinding: binding } },
    ] as unknown as CanonicalNode[];
    const doc = seededDoc(insts);
    const model = buildCanonicalSceneModel(doc, {
      collections: [
        {
          name: "dt",
          useMockData: true,
          mockData: [
            { id: 1, label: "ROW1" },
            { id: 2, label: "ROW2" },
          ],
        },
      ] as never,
    });
    const lbKids = model.sceneChildrenByParent.get("lb-b") ?? [];
    expect(lbKids.every((k) => k.id.startsWith("projection:"))).toBe(true);
    const tagKids =
      model.sceneChildrenByParent.get("tg-b/component-taggroup__2") ?? [];
    expect(tagKids.every((k) => k.id.startsWith("projection:"))).toBe(true);
    const resolvedAll = resolveCanonicalDocument(doc) as ResolvedNode[];
    expect(findResolved(resolvedAll, "lb-b")!.children ?? []).toEqual([]);
    const tagList = (findResolved(resolvedAll, "tg-b")!.children ?? []).find(
      (c) => c.type === "TagList",
    )!;
    expect(tagList.children ?? []).toEqual([]);
  });

  it("Canvas: 선택 = ListBox selectedKeys → 그 항목만 isSelected · 선택 배경", () => {
    const doc = seededDoc([
      {
        ...listBoxInstance,
        props: { selectedKeys: ["starred"] },
      } as unknown as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc);
    const items = model.sceneChildrenByParent.get("lb-1") ?? [];
    expect(
      items.map((i) => (i.props as Record<string, unknown>).isSelected),
    ).toEqual([undefined, true, undefined]);
    expect(
      items.map(
        (i) =>
          ((i.props as Record<string, unknown>).style as Record<string, unknown>)
            ?.backgroundColor,
      ),
    ).toEqual([undefined, "var(--accent-subtle)", undefined]);
  });

  it("Preview: RAC option 3 · 선택 1 + 체크 · slot 자식은 DOM `slot` 속성", () => {
    stubResizeObserver();
    const doc = seededDoc([
      {
        ...listBoxInstance,
        props: { selectedKeys: ["starred"] },
      } as unknown as CanonicalNode,
    ]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "lb-1",
    )!;
    const { container } = renderResolved(resolved);
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.map((o) => o.getAttribute("data-key"))).toEqual([
      "inbox",
      "starred",
      "archive",
    ]);
    expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(options[1]!.querySelector(".listbox-item-check")).not.toBeNull();
    expect(options[0]!.querySelector(".listbox-item-check")).toBeNull();
    expect(
      Array.from(options[0]!.children).map((c) => c.getAttribute("slot")),
    ).toEqual(["icon", "label", "description"]);
    expect(options[0]!.querySelector('[slot="label"]')!.textContent).toBe(
      "Inbox",
    );
  });

  it("Slot +: ListBox host → list-item · origin 은 자식 · instance 는 자기 자식으로 덧붙어 두 leg 가 4 항목", () => {
    const doc = seededDoc([listBoxInstance]);
    const lb = findById(doc.children, "component-listbox")!;
    expect(
      resolveSlotInsertAction(
        lb as unknown as Parameters<typeof resolveSlotInsertAction>[0],
        findById(
          doc.children,
          "component-listbox-item-default",
        ) as unknown as Parameters<typeof resolveSlotInsertAction>[1],
      ),
    ).toEqual({ kind: "list-item" });
    expect(
      planTabItemInsert({
        document: doc,
        hostId: "component-listbox",
        candidateId: "component-listbox-item-default--unselected",
        newKey: "k4",
      }),
    ).toMatchObject({
      kind: "plain",
      tabListId: "component-listbox",
      tab: {
        id: "component-listbox__item-4",
        ref: "component-listbox-item-default",
        props: { id: "k4" },
        descendants: { Label: { children: "ListBoxItem 4" } },
      },
    });
    const plan = planTabItemInsert({
      document: doc,
      hostId: "lb-1",
      candidateId: "component-listbox-item-default",
      newKey: "k4",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: "lb-1",
      tab: { id: "lb-1__item-4", props: { id: "k4" } },
    });
    const next = withUser(doc, [
      {
        ...listBoxInstance,
        children: [(plan as { tab: CanonicalNode }).tab],
      } as unknown as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(next);
    expect(
      (model.sceneChildrenByParent.get("lb-1") ?? []).map(
        (i) => (i.props as Record<string, unknown>).id,
      ),
    ).toEqual(["inbox", "starred", "archive", "k4"]);
    stubResizeObserver();
    const resolved = findResolved(
      resolveCanonicalDocument(next) as ResolvedNode[],
      "lb-1",
    )!;
    const { container } = renderResolved(resolved);
    expect(
      Array.from(container.querySelectorAll('[role="option"]')).map((o) =>
        o.getAttribute("data-key"),
      ),
    ).toEqual(["inbox", "starred", "archive", "k4"]);
  });

  it("layout: slot 자식 = ListBox.css 상자 (icon absolute · 항목 왼쪽 여백 · 자리표시 icon 은 여백 없음 · 선택 오른쪽 여백 · description 12/16)", async () => {
    const { applyImplicitStyles } = await import(
      "../../workspace/canvas/layout/engines/implicitStyles"
    );
    const node = (
      id: string,
      type: string,
      parent: string | null,
      props: Record<string, unknown> = {},
    ) => ({ id, type, parent_id: parent, props });
    const run = (iconName: string, isSelected: boolean) => {
      const item = node("it", "ListBoxItem", null, isSelected ? { isSelected } : {});
      const icon = node("ic", "Icon", "it", { slot: "icon", iconName });
      const label = node("lb", "Text", "it", { slot: "label", children: "A" });
      const desc = node("ds", "Text", "it", { slot: "description", children: "d" });
      const all = [item, icon, label, desc];
      const byId = new Map(all.map((n) => [n.id, n]));
      const childrenOf = (id: string) => all.filter((n) => n.parent_id === id);
      return applyImplicitStyles(item, childrenOf("it"), childrenOf, byId);
    };
    const result = run("star", true);
    const styleOf = (i: number) =>
      result.filteredChildren[i]!.props.style as Record<string, unknown>;
    expect(styleOf(0)).toMatchObject({
      position: "absolute",
      left: 12,
      top: "50%",
      marginTop: -8,
      width: 16,
      height: 16,
    });
    expect(styleOf(1)).toMatchObject({ fontWeight: 600, width: "100%" });
    expect(styleOf(1).fontSize).toBeUndefined();
    expect(styleOf(2)).toMatchObject({ fontSize: 12, lineHeight: "16px" });
    const parentStyle = result.effectiveParent.props.style as Record<
      string,
      unknown
    >;
    expect(parentStyle).toMatchObject({ paddingLeft: 34, paddingRight: 34 });
    const placeholder = run("{icon}", false).effectiveParent.props
      .style as Record<string, unknown>;
    expect(placeholder.paddingLeft).not.toBe(34);
    expect(placeholder.paddingRight).not.toBe(34);
  });

  it("Canvas resolver: description 12 · 줄 16 · muted / icon glyph 16 (DOM slot 규칙)", async () => {
    const { resolveItemLabelTypography } = await import(
      "../../workspace/canvas/skia/itemLabelInheritance"
    );
    const item = { id: "it", type: "ListBoxItem", props: {} };
    const desc = { id: "d", type: "Text", parent_id: "it", props: { slot: "description" } };
    const icon = { id: "i", type: "Icon", parent_id: "it", props: { slot: "icon" } };
    const label = { id: "l", type: "Text", parent_id: "it", props: { slot: "label" } };
    const map = new Map<string, typeof desc | typeof item>([
      ["it", item as typeof desc],
    ]);
    expect(resolveItemLabelTypography(desc, map)).toEqual({
      fontSize: 12,
      lineHeight: "16px",
      color: "{color.neutral-subdued}",
    });
    expect(resolveItemLabelTypography(icon, map)).toEqual({ fontSize: 16 });
    expect(resolveItemLabelTypography(label, map)).toBeNull();
  });
});

describe("ADR-234 Phase 3e — GridList (목록 틀 = owner)", () => {
  const gridListInstance = {
    id: "gl-1",
    type: "ref",
    ref: "component-gridlist",
    props: {},
  } as unknown as CanonicalNode;

  it("이관: GridList 자식 = GridListItem instance (key · label/description) · items 0 · 멱등", () => {
    const doc = seededDoc([gridListInstance]);
    const gl = findById(doc.children, "component-gridlist")!;
    expect(gl.props?.items).toBeUndefined();
    expect(gl.children).toHaveLength(3);
    expect(gl.children![0]).toMatchObject({
      type: "ref",
      ref: "component-gridlist-item-default",
      props: { id: "documents" },
      descendants: {
        Label: { children: "Documents" },
        Description: { children: "12 files" },
      },
    });
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("Canvas: 선택 = GridList selectedKeys → isSelected · 바인딩 instance 는 정적 카드 없음", () => {
    const doc = seededDoc([
      {
        ...gridListInstance,
        props: { selectionMode: "single", selectedKeys: ["images"] },
      } as unknown as CanonicalNode,
      {
        id: "gl-b",
        type: "ref",
        ref: "component-gridlist",
        props: { dataBinding: { source: "dataTable", name: "dt" } },
      } as unknown as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc, {
      collections: [
        { name: "dt", useMockData: true, mockData: [{ id: 1, label: "R1" }] },
      ] as never,
    });
    const cards = model.sceneChildrenByParent.get("gl-1") ?? [];
    expect(
      cards.map((c) => (c.props as Record<string, unknown>).isSelected),
    ).toEqual([undefined, true, undefined]);
    const bound = model.sceneChildrenByParent.get("gl-b") ?? [];
    expect(bound.every((k) => k.id.startsWith("projection:"))).toBe(true);
  });

  it("Preview: RAC row 3 · key · 선택 1 · 카드 글자 = label/description descendants", () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const doc = seededDoc([
      {
        ...gridListInstance,
        props: { selectionMode: "single", selectedKeys: ["images"] },
      } as unknown as CanonicalNode,
    ]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "gl-1",
    )!;
    const { container } = renderResolved(resolved);
    const rows = Array.from(
      container.querySelectorAll(".react-aria-GridListItem"),
    );
    expect(rows.map((r) => r.getAttribute("data-key"))).toEqual([
      "documents",
      "images",
      "downloads",
    ]);
    expect(rows.map((r) => r.hasAttribute("data-selected"))).toEqual([
      false,
      true,
      false,
    ]);
    expect(rows[0]!.textContent).toBe("Documents12 files");
    expect(
      rows[0]!.querySelector('[slot="description"]')!.textContent,
    ).toBe("12 files");
  });

  it("Slot +: GridList host → list-item · instance 는 자기 자식", () => {
    const doc = seededDoc([gridListInstance]);
    const gl = findById(doc.children, "component-gridlist")!;
    expect(
      resolveSlotInsertAction(
        gl as unknown as Parameters<typeof resolveSlotInsertAction>[0],
        findById(
          doc.children,
          "component-gridlist-item-default",
        ) as unknown as Parameters<typeof resolveSlotInsertAction>[1],
      ),
    ).toEqual({ kind: "list-item" });
    expect(
      planTabItemInsert({
        document: doc,
        hostId: "gl-1",
        candidateId: "component-gridlist-item-default",
        newKey: "k4",
      }),
    ).toMatchObject({
      kind: "plain",
      tabListId: "gl-1",
      tab: {
        id: "gl-1__item-4",
        props: { id: "k4" },
        descendants: {
          Label: { children: "GridListItem 4" },
          Description: { enabled: false },
        },
      },
    });
  });

  it("layout · Skia: 카드 label 600 (크기 기본) · description muted · 선택 카드 border 2 + padding −1", async () => {
    const { applyImplicitStyles } = await import(
      "../../workspace/canvas/layout/engines/implicitStyles"
    );
    const { resolveItemLabelTypography } = await import(
      "../../workspace/canvas/skia/itemLabelInheritance"
    );
    const node = (
      id: string,
      type: string,
      parent: string | null,
      props: Record<string, unknown> = {},
      metadata?: Record<string, unknown>,
    ) => ({ id, type, parent_id: parent, props, ...(metadata ? { metadata } : {}) });
    const card = node("c", "GridListItem", null, { isSelected: true });
    const label = node("l", "Text", "c", { children: "A" }, { slotRole: "label" });
    const desc = node("d", "Text", "c", { slot: "description", children: "b" });
    const all = [card, label, desc];
    const byId = new Map(all.map((n) => [n.id, n]));
    const childrenOf = (id: string) => all.filter((n) => n.parent_id === id);
    const result = applyImplicitStyles(card, childrenOf("c"), childrenOf, byId);
    const st = (i: number) =>
      result.filteredChildren[i]!.props.style as Record<string, unknown>;
    expect(st(0)).toMatchObject({ fontWeight: 600, width: "100%" });
    expect(st(0).fontSize).toBeUndefined();
    expect(st(1).fontWeight).toBeUndefined();
    expect(st(1).fontSize).toBeUndefined();
    const ps = result.effectiveParent.props.style as Record<string, unknown>;
    expect(ps).toMatchObject({
      borderWidth: 2,
      paddingTop: 11,
      paddingLeft: 15,
    });
    expect(resolveItemLabelTypography(desc, byId)).toEqual({
      color: "{color.neutral-subdued}",
    });
    // 정적 카드가 있는 GridList = grid 2열 (shared GridList inline) · 카드는 위에서 시작.
    const gl = node("g", "GridList", null, { layout: "grid", columns: 2 });
    const c1 = node("c1", "GridListItem", "g");
    const c2 = node("c2", "GridListItem", "g");
    const all2 = [gl, c1, c2];
    const byId2 = new Map(all2.map((n) => [n.id, n]));
    const childrenOf2 = (id: string) => all2.filter((n) => n.parent_id === id);
    const glResult = applyImplicitStyles(gl, childrenOf2("g"), childrenOf2, byId2);
    expect(glResult.effectiveParent.props.style).toMatchObject({
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      rowGap: 12,
      columnGap: 12,
    });
    expect(
      glResult.filteredChildren.map(
        (c) => (c.props.style as Record<string, unknown>).justifyContent,
      ),
    ).toEqual(["flex-start", "flex-start"]);
  });
});

describe("ADR-234 Phase 3f — Menu (항목 = popover 안 MenuItem instance 자식)", () => {
  const menuInstance = {
    id: "mn-1",
    type: "ref",
    ref: "component-menu",
    props: {},
  } as unknown as CanonicalNode;

  it("이관: Menu 자식 = MenuItem instance (label · 없는 slot 숨김) · items 0 · origin slot = MenuItem origin · 멱등 · separator/하위 메뉴 목록은 그대로", () => {
    const doc = seededDoc([menuInstance]);
    const menu = findById(doc.children, "component-menu")!;
    expect(menu.props?.items).toBeUndefined();
    expect(menu.slot).toEqual(["component-menu-item-default"]);
    expect(menu.children).toHaveLength(3);
    expect(menu.children![0]).toMatchObject({
      type: "ref",
      ref: "component-menu-item-default",
      descendants: {
        Icon: { enabled: false },
        Label: { children: "Menu Item 1" },
        Shortcut: { enabled: false },
        Description: { enabled: false },
      },
    });
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
    const sep = {
      id: "sep-menu",
      type: "Menu",
      props: {
        items: [
          { id: "a", label: "A" },
          { id: "s", type: "separator" },
        ],
      },
    } as CanonicalNode;
    const sub = {
      id: "sub-menu",
      type: "Menu",
      props: {
        items: [{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }],
      },
    } as CanonicalNode;
    const doc2 = seededDoc([sep, sub]);
    expect(findById(doc2.children, "sep-menu")!.props?.items).toHaveLength(2);
    expect(findById(doc2.children, "sub-menu")!.props?.items).toHaveLength(1);
  });

  it("Canvas: MenuItem 자식은 popover 내용 — layout 자식이 아니고 (기존 경로) 트리거 글자는 남는다 (static)", async () => {
    const { applyImplicitStyles } = await import(
      "../../workspace/canvas/layout/engines/implicitStyles"
    );
    const menu = { id: "m", type: "Menu", parent_id: null, props: { label: "Menu" } };
    const item = { id: "i", type: "MenuItem", parent_id: "m", props: {} };
    const all = [menu, item];
    const byId = new Map(all.map((n) => [n.id, n]));
    const childrenOf = (id: string) => all.filter((n) => n.parent_id === id);
    expect(
      applyImplicitStyles(menu, childrenOf("m"), childrenOf, byId)
        .filteredChildren,
    ).toEqual([]);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../workspace/canvas/skia/buildSpecNodeData.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(
      /type === "Menu"\s*\?\s*childElements\?\.filter\(\(child\) => child\.type !== "MenuItem"\)/,
    );
  });

  it("Preview: popover 를 열면 RAC menuitem 3 (key = 항목 id · 글자 = label descendants · 이관 전 행 DOM)", async () => {
    const { fireEvent, act } = await import("@testing-library/react");
    const doc = seededDoc([menuInstance]);
    const keys = (findById(doc.children, "component-menu")!.children ?? []).map(
      (c) => String(c.props?.id),
    );
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "mn-1",
    )!;
    const { container, baseElement } = renderResolved(resolved);
    const trigger = container.querySelector("button")!;
    await act(async () => {
      fireEvent.click(trigger);
    });
    const items = Array.from(
      baseElement.querySelectorAll('[role="menuitem"]'),
    );
    expect(items.map((i) => i.getAttribute("data-key"))).toEqual(keys);
    expect(
      items.map((i) => i.querySelector(".menu-item-label")?.textContent),
    ).toEqual(["Menu Item 1", "Menu Item 2", "Menu Item 3"]);
    expect(items[0]!.querySelector(".menu-item-shortcut")).toBeNull();
  });

  it("Slot +: Menu origin 은 slot host · list-item · 바인딩 instance 는 정적 항목 없음", async () => {
    const { isSlotHostElement } = await import("../slotHostPolicy");
    const doc = seededDoc([
      menuInstance,
      {
        id: "mn-b",
        type: "ref",
        ref: "component-menu",
        props: { dataBinding: { source: "dataTable", name: "dt" } },
      } as unknown as CanonicalNode,
    ]);
    const menu = findById(doc.children, "component-menu")!;
    expect(
      isSlotHostElement(
        menu as unknown as Parameters<typeof isSlotHostElement>[0],
      ),
    ).toBe(true);
    expect(
      resolveSlotInsertAction(
        menu as unknown as Parameters<typeof resolveSlotInsertAction>[0],
        findById(
          doc.children,
          "component-menu-item-default",
        ) as unknown as Parameters<typeof resolveSlotInsertAction>[1],
      ),
    ).toEqual({ kind: "list-item" });
    expect(
      planTabItemInsert({
        document: doc,
        hostId: "mn-1",
        candidateId: "component-menu-item-default",
        newKey: "k4",
      }),
    ).toMatchObject({
      kind: "plain",
      tabListId: "mn-1",
      tab: { id: "mn-1__item-4", descendants: { Label: { children: "MenuItem 4" } } },
    });
    const resolvedAll = resolveCanonicalDocument(doc) as ResolvedNode[];
    expect(findResolved(resolvedAll, "mn-b")!.children ?? []).toEqual([]);
    expect(findResolved(resolvedAll, "mn-1")!.children ?? []).toHaveLength(3);
  });
});

describe("ADR-234 Phase 3 — 전파 규칙 (Tabs → TabList · TagGroup → TagList `items`)", () => {
  it("이관된 정적 owner (items 없음) 는 목록 틀에 items 를 쓰지 않는다 · 바인딩 owner 는 그대로 전파", async () => {
    const { resolvePropagatedProps } = await import(
      "../../utils/propagationEngine"
    );
    const doc = seededDoc();
    const tabs = findById(doc.children, "component-tabs")!;
    const tabList = tabs.children!.find((c) => c.type === "TabList")!;
    const tg = findById(doc.children, "component-taggroup")!;
    const tagList = tg.children!.find((c) => c.type === "TagList")!;
    const itemsOf = (
      parent: CanonicalNode,
      child: CanonicalNode,
    ): unknown =>
      resolvePropagatedProps(
        parent.type,
        (parent.props ?? {}) as Record<string, unknown>,
        child.type,
        (child.props ?? {}) as Record<string, unknown>,
      )?.items;
    expect(itemsOf(tabs, tabList)).toBeUndefined();
    expect(itemsOf(tg, tagList)).toBeUndefined();
    const boundItems = [{ id: "a", label: "A" }];
    expect(
      itemsOf(
        { ...tg, props: { ...tg.props, items: boundItems } } as CanonicalNode,
        tagList,
      ),
    ).toEqual(boundItems);
  });
});

describe("ADR-234 G5 — Tag leading slot 자식 = 이관 전 chip 규칙", () => {
  it("layout: icon 14 (자리표시는 숨김) · avatar 16 (minWidth 도) · Skia icon glyph 14 · avatar 지름 16", async () => {
    const { applyImplicitStyles } = await import(
      "../../workspace/canvas/layout/engines/implicitStyles"
    );
    const { resolveItemLabelTypography, resolveItemLeadingAvatarSize } =
      await import("../../workspace/canvas/skia/itemLabelInheritance");
    const node = (
      id: string,
      type: string,
      parent: string | null,
      props: Record<string, unknown> = {},
    ) => ({ id, type, parent_id: parent, props });
    const run = (iconName: string) => {
      const tag = node("t", "Tag", null);
      const icon = node("i", "Icon", "t", { slot: "icon", iconName });
      const avatar = node("a", "Avatar", "t", { slot: "avatar", src: "x.png" });
      const all = [tag, icon, avatar];
      const byId = new Map(all.map((n) => [n.id, n]));
      const childrenOf = (id: string) => all.filter((n) => n.parent_id === id);
      return {
        result: applyImplicitStyles(tag, childrenOf("t"), childrenOf, byId),
        icon,
        avatar,
        byId,
      };
    };
    const { result, icon, avatar, byId } = run("star");
    const st = (i: number) =>
      result.filteredChildren[i]!.props.style as Record<string, unknown>;
    expect(st(0)).toMatchObject({ width: 14, height: 14, fontSize: 14 });
    expect(st(1)).toMatchObject({ width: 16, minWidth: 16, height: 16 });
    expect(
      (run("{icon}").result.filteredChildren[0]!.props.style as Record<
        string,
        unknown
      >).display,
    ).toBe("none");
    expect(resolveItemLabelTypography(icon, byId)).toMatchObject({
      fontSize: 14,
    });
    expect(resolveItemLeadingAvatarSize(avatar, byId)).toBe(16);
  });

  it("DOM: TagGroup 안 Tag 의 icon 자식은 `slot` 속성 (TagGroup.css leading 규칙이 닿는다)", () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const doc = seededDoc([
      {
        id: "tg-icon",
        type: "ref",
        ref: "component-taggroup",
        props: { items: [{ id: "a", label: "Alpha", icon: "star" }] },
      } as unknown as CanonicalNode,
    ]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "tg-icon",
    )!;
    const { container } = renderResolved(resolved);
    const tag = container.querySelector('.react-aria-Tag[role="row"]')!;
    expect(tag.querySelector('.react-aria-Icon[slot="icon"]')).not.toBeNull();
    const css = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/TagGroup.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/> \.react-aria-Icon\[slot="icon"\] \{[^}]*width: 14px/);
  });
});
