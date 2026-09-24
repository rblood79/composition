import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import {
  resolveCanonicalRefTree,
  resolveCanvasTreeItemKey,
} from "../../../adapters/canonical/canonicalRefResolution";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import {
  flattenTreeRows,
  isTreeItemExpanded,
  type TreeRowNode,
} from "../../workspace/canvas/treeItemRow";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes, resolveChainEnd } from "../staticCollectionMigration";
import { resolveSlotInsertAction } from "../slotHostPolicy";

/**
 * ADR-239 Phase 0 — 진단 RED (breakdown §4 Phase 0 (a)~(e)).
 * `it` = 닫힌 결함 (닫은 Phase 가 `it.fails` → `it` 으로 바꾼다) · `it.fails` = 아직 열린 결함:
 *   (a) (c) → Phase 1 · (b) → Phase 2 (닫힘 — `it`) · (d) → Phase 3 · (e) → Phase 4.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function seededDoc(user: CanonicalNode[] = []): CompositionDocument {
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
    } as CompositionDocument),
  );
}

function childrenMap(byId: ReadonlyMap<string, CanonicalNode>) {
  const map = new Map<string, CanonicalNode[]>();
  for (const node of byId.values()) {
    if (node.children?.length) map.set(node.id, [...node.children]);
  }
  return map;
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

function renderById(doc: CompositionDocument, id: string) {
  const resolved = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  )!;
  return render(
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
}

/** 중첩 plain Tree — `A > B` · `C` (factory 기본 `expandedKeys: []`). */
function nestedTree(props: Record<string, unknown> = {}): CanonicalNode {
  return {
    id: "tree-1",
    type: "Tree",
    props: { "aria-label": "T", selectionMode: "single", ...props },
    children: [
      {
        id: "ti-a",
        type: "TreeItem",
        props: { children: "A" },
        children: [{ id: "ti-b", type: "TreeItem", props: { children: "B" } }],
      },
      { id: "ti-c", type: "TreeItem", props: { children: "C" } },
    ],
  } as unknown as CanonicalNode;
}

// ── (a) Tree instance 에 Slot "+" 없음 · TreeItem 안 항목 추가 경로 없음 (F2) ─────────────
describe("ADR-239 진단 (a) — Tree · TreeItem 이 slot host 가 아니다 (F2)", () => {
  it(
    "Tree origin 의 slot = TreeItem origin · Tree / TreeItem instance 가 항목 넣기 host",
    () => {
      const doc = seededDoc();
      const byId = indexNodes(doc);
      const origin = byId.get("component-tree")!;
      expect(Array.isArray(origin.slot)).toBe(true);
      const candidate = byId.get((origin.slot as string[])[0]!)!;
      expect(resolveChainEnd(candidate.id, byId)?.type).toBe("TreeItem");
      for (const host of [
        { type: "Tree", slot: origin.slot },
        { type: "TreeItem" },
      ]) {
        expect(
          resolveSlotInsertAction(host as never, candidate as never).kind,
          host.type,
        ).toBe("list-item");
      }
    },
  );
});

// ── (b) 중첩 Tree 펼침 두 leg 발산 (F3 · F4) ─────────────────────────────────────────────
describe("ADR-239 진단 (b) — 중첩 TreeItem: Canvas 는 전부 그리고 Preview 는 전부 접는다 (F4)", () => {
  /**
   * Canvas 행 집합 = layout 이 Tree 에 펴는 행 (`flattenTreeRows` + 유효 펼침 `isTreeItemExpanded` — Phase 2). 239 전에는
   * 펼침 판정이 없어 scene 의 TreeItem 을 전부 그렸다 (live: 자식 행이 부모 행에 겹침).
   */
  function canvasRows(doc: CompositionDocument): string[] {
    const model = buildCanonicalSceneModel(doc);
    const kids = (id: string) =>
      (model.sceneChildrenByParent.get(id) ?? []) as TreeRowNode[];
    return flattenTreeRows(kids("tree-1"), kids, (item) =>
      isTreeItemExpanded(item, model.sceneNodesMap as never),
    ).map((row) => row.id);
  }

  function previewRows(doc: CompositionDocument): string[] {
    const { container } = renderById(doc, "tree-1");
    return [...container.querySelectorAll<HTMLElement>('[role="row"]')].map(
      (row) => row.getAttribute("data-element-id") ?? "",
    );
  }

  it("239 전 문서 (plain · `expandedKeys: []`) — 이관이 부모 key 를 채워 두 leg 모두 3 행 (Canvas 가 보던 행 집합)", () => {
    const doc = seededDoc([nestedTree({ expandedKeys: [] })]);
    expect(canvasRows(doc)).toEqual(["ti-a", "ti-b", "ti-c"]);
    expect(previewRows(doc)).toEqual(["ti-a", "ti-b", "ti-c"]);
  });

  it("같은 문서에서 두 leg 가 같은 행 집합을 보인다 (비어 있지 않은 `expandedKeys` 는 보존 — 접힌 자식 제외)", () => {
    for (const expandedKeys of [[], ["ti-c"], ["ti-a"]]) {
      const doc = seededDoc([nestedTree({ expandedKeys })]);
      expect(canvasRows(doc), JSON.stringify(expandedKeys)).toEqual(
        previewRows(doc),
      );
      cleanup();
    }
    const collapsed = seededDoc([nestedTree({ expandedKeys: ["ti-c"] })]);
    expect(canvasRows(collapsed)).toEqual(["ti-a", "ti-c"]);
  });
});

// ── (c) 같은 TreeItem origin 을 참조하는 형제의 상속 자식 key 충돌 (238 (c) 와 같은 뿌리) ──────
describe("ADR-239 진단 (c) — 같은 TreeItem origin instance 둘의 상속 자식이 같은 RAC key", () => {
  it("상속 자식 key 가 Tree 안에서 유일하다", () => {
    const doc = seededDoc([
      {
        id: "ti-origin",
        type: "TreeItem",
        reusable: true,
        props: { children: "Parent" },
        children: [
          {
            id: "ti-origin__child",
            type: "TreeItem",
            props: { id: "child", children: "Child" },
          },
        ],
      },
      {
        id: "tree-2",
        type: "Tree",
        props: { "aria-label": "T" },
        children: [
          { id: "ti-x", type: "ref", ref: "ti-origin", props: {} },
          { id: "ti-y", type: "ref", ref: "ti-origin", props: {} },
        ],
      },
    ] as unknown as CanonicalNode[]);
    const byId = indexNodes(doc);
    const tree = resolveCanonicalRefTree<CanonicalNode>({
      elements: [byId.get("ti-x")!, byId.get("ti-y")!],
      elementsMap: byId,
      childrenMap: childrenMap(byId),
    });
    // Phase 1 — key = `resolveTreeItemKey` (부모 TreeItem 이 instance 면 부모 key 접두). 239 전 key
    //   (`resolveStaticItemKey` — 노드 id · `props.id`) 는 둘 다 "child" 였다.
    const keys = ["ti-x", "ti-y"].flatMap((parent) =>
      (tree.childrenMap.get(parent) ?? [])
        .filter((item) => String(item.type) === "TreeItem")
        .map((item) => resolveCanvasTreeItemKey(item, tree.elementsMap)),
    );
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
});

// ── (d) 하위 메뉴 (F7) ────────────────────────────────────────────────────────────────
describe("ADR-239 진단 (d) — Menu 하위 메뉴가 `items.children` 에만 있다 (F7)", () => {
  it(
    "하위 메뉴 행이 있는 정적 Menu 가 instance 자식으로 이관된다",
    () => {
      const doc = seededDoc([
        {
          id: "sub-menu",
          type: "Menu",
          props: {
            items: [
              { id: "open", label: "Open" },
              {
                id: "share",
                label: "Share",
                children: [
                  { id: "mail", label: "Mail" },
                  { id: "sms", label: "SMS" },
                ],
              },
            ],
          },
        } as CanonicalNode,
      ]);
      const menu = indexNodes(doc).get("sub-menu")!;
      expect(menu.props?.items).toBeUndefined();
      expect((menu.children ?? []).length).toBe(2);
    },
  );
});

// ── (e) ColorSwatchPicker (R5 · F9) ──────────────────────────────────────────────────
describe("ADR-239 진단 (e) — ColorSwatchPicker 항목 origin 없음 · 같은 색 swatch 는 한 항목으로 합쳐진다 (R5)", () => {
  it('사실 (R5) — RAC 항목 id = 색 (`color.toString("hexa")`) 이라 같은 색 swatch 둘은 한 항목으로 합쳐진다', () => {
    const doc = seededDoc([
      {
        id: "csp-1",
        type: "ColorSwatchPicker",
        props: { defaultValue: "#ff0000" },
        children: [
          { id: "sw-1", type: "ColorSwatch", props: { color: "#ff0000" } },
          { id: "sw-2", type: "ColorSwatch", props: { color: "#ff0000" } },
          { id: "sw-3", type: "ColorSwatch", props: { color: "#00ff00" } },
        ],
      } as unknown as CanonicalNode,
    ]);
    // Canvas 는 swatch 자식 3 을 상자로 그린다 (F10) — Preview 는 2 항목.
    const { container } = renderById(doc, "csp-1");
    expect(container.querySelectorAll('[role="option"]').length).toBe(2);
    // 239 전: picker 에 `defaultValue` 가 닿지 않아 (F9) 아무것도 선택되지 않는다.
    expect(container.querySelectorAll('[aria-selected="true"]').length).toBe(0);
  });

  it.fails(
    "ColorSwatchPicker origin 의 slot = ColorSwatch origin · swatch 는 ref 이고 색이 유일",
    () => {
      const doc = seededDoc();
      const byId = indexNodes(doc);
      const origin = [...byId.values()].find(
        (n) => n.type === "ColorSwatchPicker" && n.reusable === true,
      )!;
      expect(origin).toBeDefined();
      const slot = origin.slot as string[];
      expect(byId.get(slot[0]!)?.type).toBe("ColorSwatch");
      const swatches = origin.children ?? [];
      expect(swatches.every((s) => s.type === "ref")).toBe(true);
      const colors = swatches.map(
        (s) => (s.props as Record<string, unknown>).color,
      );
      expect(new Set(colors).size).toBe(colors.length);
    },
  );
});
