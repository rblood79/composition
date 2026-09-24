import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanvasTreeItemKey } from "../../../adapters/canonical/canonicalRefResolution";
import { planTabItemInsert } from "../collectionItemInsert";

import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes } from "../staticCollectionMigration";
import {
  TREE_ITEM_DEFAULT_ORIGIN_ID,
  TREE_ORIGIN_ID,
  migrateTreeItemsToInstances,
} from "../tree/treeTemplateOrigins";

/**
 * ADR-239 Phase 1 — TreeItem origin · Tree origin 구조 · 기존 Tree 이관 (breakdown §4 Phase 1 · G1).
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seededDoc(
  user: CanonicalNode[] = [],
  extra: Partial<CompositionDocument> = {},
): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins({
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
      ...extra,
    } as CompositionDocument),
  );
}

const plainItem = (
  id: string,
  text: string,
  children?: CanonicalNode[],
): CanonicalNode =>
  ({
    id,
    type: "TreeItem",
    props: { children: text },
    ...(children ? { children } : {}),
  }) as unknown as CanonicalNode;

describe("ADR-239 Phase 1 — TreeItem origin · Tree origin (새 문서)", () => {
  it("TreeItem origin = 선택 상태 + Label 역할 자식 + slot · 변형 6 (ref)", () => {
    const byId = indexNodes(seededDoc());
    const origin = byId.get(TREE_ITEM_DEFAULT_ORIGIN_ID)!;
    expect(origin).toMatchObject({
      type: "TreeItem",
      reusable: true,
      metadata: { variant: "selected", systemOwned: true },
    });
    expect(origin.slot).toEqual([
      `${TREE_ITEM_DEFAULT_ORIGIN_ID}--unselected`,
      TREE_ITEM_DEFAULT_ORIGIN_ID,
    ]);
    expect(
      (origin.children ?? []).map((c) => [
        c.type,
        (c.metadata as Record<string, unknown>).slotRole,
        (c.props as Record<string, unknown>).slot,
      ]),
    ).toEqual([["Text", "label", undefined]]);
    for (const state of [
      "unselected",
      "disabled",
      "hover",
      "pressed",
      "focus-visible",
      "collapsed",
    ]) {
      const variant = byId.get(`${TREE_ITEM_DEFAULT_ORIGIN_ID}--${state}`);
      expect(variant, state).toMatchObject({
        type: "ref",
        ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
      });
    }
  });

  it("Tree origin 자식 = TreeItem instance (중첩 예시 1 · 펼침) · slot = TreeItem origin 2", () => {
    const tree = indexNodes(seededDoc()).get(TREE_ORIGIN_ID)!;
    expect(tree.slot).toEqual([
      `${TREE_ITEM_DEFAULT_ORIGIN_ID}--unselected`,
      TREE_ITEM_DEFAULT_ORIGIN_ID,
    ]);
    expect((tree.props as Record<string, unknown>).expandedKeys).toEqual([
      "item-1",
    ]);
    const shape = (nodes: readonly CanonicalNode[] = []): unknown[] =>
      nodes.map((n) => [
        (n as { ref?: string }).ref,
        (n.props as Record<string, unknown>).id,
        shape(n.children),
      ]);
    expect(shape(tree.children)).toEqual([
      [
        TREE_ITEM_DEFAULT_ORIGIN_ID,
        "item-1",
        [[TREE_ITEM_DEFAULT_ORIGIN_ID, "item-1-1", []]],
      ],
      [TREE_ITEM_DEFAULT_ORIGIN_ID, "item-2", []],
    ]);
  });

  it("재hydration Δ0", () => {
    const doc = seededDoc();
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });
});

describe("ADR-239 Phase 1 — 기존 plain Tree 이관 (같은 id ref · key 대응)", () => {
  function legacyDoc() {
    return seededDoc(
      [
        {
          id: "tree-1",
          type: "Tree",
          props: {
            "aria-label": "T",
            selectionMode: "single",
            selectedKeys: ["ti-b"],
            expandedKeys: ["ti-a"],
          },
          children: [
            plainItem("ti-a", "A", [plainItem("ti-b", "B")]),
            plainItem("ti-c", "C"),
          ],
        } as unknown as CanonicalNode,
      ],
      {
        events: [
          {
            id: "rule-1",
            type: "interaction",
            elementId: "btn",
            trigger: "onPress",
            action: {
              kind: "capability",
              targetId: "tree-1",
              capability: "selectItem",
              params: { value: "ti-b" },
            },
          },
        ] as unknown as CompositionDocument["events"],
      },
    );
  }

  it("plain TreeItem → 같은 id ref (`props.id` = 옛 key · Label descendants) · 중첩 key 접두 · 네 필드 · interaction 대응", () => {
    const doc = legacyDoc();
    const byId = indexNodes(doc);
    const a = byId.get("ti-a")!;
    expect(a).toMatchObject({
      type: "ref",
      ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
      props: { id: "ti-a" },
      descendants: { Label: { children: "A" } },
    });
    expect((a.props as Record<string, unknown>).children).toBeUndefined();
    expect(a.children!.map((c) => [c.id, c.type])).toEqual([["ti-b", "ref"]]);
    const tree = byId.get("tree-1")!;
    // 부모 (ti-a) 가 ref 가 돼 중첩 항목 key = `ti-a/ti-b` — 선택 key 가 그 항목을 계속 가리킨다.
    expect(tree.props).toMatchObject({
      selectedKeys: ["ti-a/ti-b"],
      expandedKeys: ["ti-a"],
    });
    const rule = (doc.events ?? [])[0] as unknown as {
      action: { params: { value: string } };
    };
    expect(rule.action.params.value).toBe("ti-a/ti-b");
  });

  it("멱등 — 이관을 지난 문서는 같은 객체", () => {
    const doc = legacyDoc();
    expect(migrateTreeItemsToInstances(doc)).toBe(doc);
  });

  it("대응 없는 key 가 남는 Tree 는 이관 보류", () => {
    const doc = seededDoc([
      {
        id: "tree-2",
        type: "Tree",
        props: { selectedKeys: ["ghost"] },
        children: [plainItem("ti-x", "X")],
      } as unknown as CanonicalNode,
    ]);
    const tree = indexNodes(doc).get("tree-2")!;
    expect(tree.children![0]!.type).toBe("TreeItem");
  });

  it("바인딩 Tree 는 대상 밖", () => {
    const doc = seededDoc([
      {
        id: "tree-3",
        type: "Tree",
        props: {},
        dataBinding: { type: "collection", source: "static", config: {} },
        children: [plainItem("ti-y", "Y")],
      } as unknown as CanonicalNode,
    ]);
    expect(indexNodes(doc).get("ti-y")!.type).toBe("TreeItem");
  });
});
// ───────────────────────────── 두 leg (Preview DOM · Canvas key) · Slot "+" ─────────────────────────────

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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

function previewRows(doc: CompositionDocument, id: string) {
  const resolved = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  )!;
  const { container } = render(
    <CanonicalNodeRenderer
      node={resolved}
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
  return [...container.querySelectorAll<HTMLElement>('[role="row"]')].map(
    (row) => ({
      key: row.getAttribute("data-key"),
      text: row.textContent?.trim(),
      titleSpans: row.querySelectorAll(".tree-item-title").length,
    }),
  );
}

describe("ADR-239 Phase 1 — 두 leg (Tree instance · 항목 key · 역할 자식)", () => {
  const instanceDoc = () =>
    seededDoc([
      { id: "t-inst", type: "ref", ref: TREE_ORIGIN_ID, props: {} },
    ] as unknown as CanonicalNode[]);

  it("Preview: origin 항목 상속 · 펼침 (origin expandedKeys) · key = 부모 instance 접두 · 글자 = Label 자식 (title span 없음)", () => {
    expect(previewRows(instanceDoc(), "t-inst")).toEqual([
      { key: "item-1", text: "Node 1", titleSpans: 0 },
      { key: "item-1/item-1-1", text: "Node 1.1", titleSpans: 0 },
      { key: "item-2", text: "Node 2", titleSpans: 0 },
    ]);
  });

  it("Canvas: 같은 항목의 key 가 Preview 와 같다 (`resolveCanvasTreeItemKey`)", () => {
    const model = buildCanonicalSceneModel(instanceDoc());
    const keys: string[] = [];
    const visit = (id: string) => {
      for (const child of model.sceneChildrenByParent.get(id) ?? []) {
        if (child.type !== "TreeItem") continue;
        keys.push(
          resolveCanvasTreeItemKey(
            child as never,
            model.sceneNodesMap as never,
          ),
        );
        visit(child.id);
      }
    };
    visit("t-inst");
    expect(keys).toEqual(["item-1", "item-1/item-1-1", "item-2"]);
  });

  it('Slot "+": Tree instance root → 자기 자식 항목 · TreeItem instance → 그 항목의 자식 (선택 key 대신 host 펼침)', () => {
    const doc = seededDoc([
      {
        id: "t-plain",
        type: "Tree",
        props: { selectionMode: "single" },
        children: [
          {
            id: "own-1",
            type: "ref",
            ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
            props: { id: "own-1" },
          },
        ],
      },
      { id: "t-inst", type: "ref", ref: TREE_ORIGIN_ID, props: {} },
    ] as unknown as CanonicalNode[]);
    const rootPlan = planTabItemInsert({
      document: doc,
      hostId: "t-inst",
      candidateId: TREE_ITEM_DEFAULT_ORIGIN_ID,
      newKey: "k-root",
    });
    expect(rootPlan).toMatchObject({
      kind: "plain",
      tabListId: "t-inst",
      tab: {
        type: "ref",
        ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
        props: { id: "k-root" },
      },
    });
    const nestedPlan = planTabItemInsert({
      document: doc,
      hostId: "own-1",
      candidateId: TREE_ITEM_DEFAULT_ORIGIN_ID,
      newKey: "k-nested",
    });
    expect(nestedPlan).toMatchObject({
      kind: "plain",
      tabListId: "own-1",
      tab: { ref: TREE_ITEM_DEFAULT_ORIGIN_ID, props: { id: "k-nested" } },
      // Phase 2 — 선택 key 대신 host 를 소속 Tree 펼침에 더한다 (넣은 항목이 두 leg 에 보인다).
      selection: { ownerId: "t-plain", props: { expandedKeys: ["own-1"] } },
    });
    expect(
      (nestedPlan as { tab: { descendants?: unknown } }).tab.descendants,
    ).toEqual({ Label: { children: "TreeItem 1" } });
  });
});
