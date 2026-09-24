import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { applyCanonicalHistoryEventsToDocument } from "../../stores/history/canonicalHistoryEvents";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";
import {
  COLOR_SWATCH_ORIGIN_ID,
  COLOR_SWATCH_PICKER_ORIGIN_ID,
} from "../colorswatch/colorSwatchOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import {
  TREE_ITEM_DEFAULT_ORIGIN_ID,
  TREE_ORIGIN_ID,
} from "../tree/treeTemplateOrigins";

/**
 * ADR-239 G6 — 저장 history 스냅샷 재생 (240 F28 선례). origin 편집 history = Components body 전체 remove + insert.
 * 239 전 스냅샷을 이관 뒤 Undo 해도 이관이 더한 origin 이 남고 (항목 ref 가 끊기지 않는다) `component-tree` 는 ref 항목.
 */

afterEach(() => vi.restoreAllMocks());

const ADDED_BY_239 = [
  TREE_ITEM_DEFAULT_ORIGIN_ID,
  COLOR_SWATCH_ORIGIN_ID,
  COLOR_SWATCH_PICKER_ORIGIN_ID,
];
const addedBy239 = (id: string) =>
  ADDED_BY_239.some((origin) => id === origin || id.startsWith(`${origin}--`));

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

/** 239 이관을 지난 문서 — Home 에 239 전 모양의 plain Tree · ColorSwatchPicker. */
function migratedDoc(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const item = (id: string, text: string, children?: CanonicalNode[]) =>
    ({
      id,
      type: "TreeItem",
      props: { children: text },
      ...(children ? { children } : {}),
    }) as unknown as CanonicalNode;
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
              children: [
                {
                  id: "ut",
                  type: "Tree",
                  props: { "aria-label": "T" },
                  children: [
                    item("ut-a", "A", [item("ut-b", "B")]),
                    item("ut-c", "C"),
                  ],
                } as unknown as CanonicalNode,
                {
                  id: "up",
                  type: "ColorSwatchPicker",
                  props: {},
                  children: [
                    {
                      id: "up-1",
                      type: "ColorSwatch",
                      props: { color: "#f00" },
                    },
                    {
                      id: "up-2",
                      type: "ColorSwatch",
                      props: { color: "#0f0" },
                    },
                  ],
                } as unknown as CanonicalNode,
              ],
            },
          ],
        },
      ],
    } as CompositionDocument),
  );
}

/** 239 전 Components body — 239 가 더한 origin 없음 · `component-tree` 항목 plain. */
function toPre239Body(body: CanonicalNode): CanonicalNode {
  const plain = (node: CanonicalNode): CanonicalNode =>
    ({
      id: node.id,
      type: "TreeItem",
      props: { children: node.id },
      ...(node.children ? { children: node.children.map(plain) } : {}),
    }) as unknown as CanonicalNode;
  return {
    ...body,
    children: (body.children ?? [])
      .filter((child) => !addedBy239(child.id))
      .map((child) =>
        child.id === TREE_ORIGIN_ID
          ? ({
              ...child,
              props: { ...child.props, expandedKeys: [] },
              children: (child.children ?? []).map(plain),
            } as CanonicalNode)
          : child,
      ),
  };
}

function bodyLocation(doc: CompositionDocument) {
  const walk = (
    nodes: readonly CanonicalNode[],
    parentId: string,
  ): { parentId: string; index: number } | null => {
    for (const [index, node] of nodes.entries()) {
      if (node.id === COMPONENTS_SYSTEM_BODY_ID) return { parentId, index };
      const hit = walk(node.children ?? [], node.id);
      if (hit) return hit;
    }
    return null;
  };
  return walk(doc.children, "")!;
}

describe("ADR-239 G6 — history body 스냅샷 재생", () => {
  it("239 전 Components body 스냅샷 Undo · Redo — 이관이 더한 origin 이 남고 Home 의 Tree 항목 · swatch 가 해석된다", () => {
    const migrated = migratedDoc();
    const preBody = toPre239Body(
      find(migrated.children, COMPONENTS_SYSTEM_BODY_ID)!,
    );
    const location = bodyLocation(migrated);
    const events = [
      { type: "remove" as const, node: preBody, ...location },
      {
        type: "insert" as const,
        node: { ...preBody, props: { ...preBody.props, "data-edit": 1 } },
        ...location,
      },
    ];
    const undone = applyCanonicalHistoryEventsToDocument(
      migrated,
      events,
      "undo",
    );
    for (const id of ADDED_BY_239) {
      expect(find(undone.children, id), id).toBeDefined();
    }
    // 판독 L1 — 되살린 origin 은 현재 body 의 자리 (끝에 붙이지 않는다).
    const order = (doc: CompositionDocument) =>
      (find(doc.children, COMPONENTS_SYSTEM_BODY_ID)!.children ?? []).map(
        (child) => child.id,
      );
    expect(order(undone)).toEqual(order(migrated));
    expect(
      (find(undone.children, TREE_ORIGIN_ID)!.children ?? []).map(
        (child) => child.type,
      ),
    ).toEqual(["ref", "ref"]);
    const model = buildCanonicalSceneModel(undone);
    expect(model.sceneNodesMap.get("ut-a")?.type).toBe("TreeItem");
    expect(model.sceneNodesMap.get("ut-b")?.type).toBe("TreeItem");
    expect(model.sceneNodesMap.get("up-1")?.type).toBe("ColorSwatch");

    const redone = applyCanonicalHistoryEventsToDocument(
      undone,
      events,
      "redo",
    );
    for (const id of ADDED_BY_239) {
      expect(find(redone.children, id), id).toBeDefined();
    }
    expect(
      find(redone.children, COMPONENTS_SYSTEM_BODY_ID)!.props?.["data-edit"],
    ).toBe(1);
  });

  it("사용자가 그 항목에서 지운 origin 은 되살리지 않는다 (두 스냅샷 중 하나에 있다)", () => {
    const migrated = migratedDoc();
    const body = find(migrated.children, COMPONENTS_SYSTEM_BODY_ID)!;
    const location = bodyLocation(migrated);
    // 항목: TreeItem origin 삭제 (before 에 있고 after 에 없음) — Redo 는 다시 지운다.
    const before = body;
    const after = {
      ...body,
      children: (body.children ?? []).filter(
        (child) => child.id !== COLOR_SWATCH_ORIGIN_ID,
      ),
    };
    const events = [
      { type: "remove" as const, node: before, ...location },
      { type: "insert" as const, node: after, ...location },
    ];
    const current = applyCanonicalHistoryEventsToDocument(
      migrated,
      events,
      "redo",
    );
    expect(find(current.children, COLOR_SWATCH_ORIGIN_ID)).toBeUndefined();
    const undone = applyCanonicalHistoryEventsToDocument(
      current,
      events,
      "undo",
    );
    expect(find(undone.children, COLOR_SWATCH_ORIGIN_ID)).toBeDefined();
  });

  it("239 전 Tree origin 하나의 스냅샷 · 사용자 페이지의 plain Tree 스냅샷 Undo — 항목 ref 로 재삽입", () => {
    const migrated = migratedDoc();
    const preBody = toPre239Body(
      find(migrated.children, COMPONENTS_SYSTEM_BODY_ID)!,
    );
    const preOrigin = find(preBody.children ?? [], TREE_ORIGIN_ID)!;
    const originIndex = (
      find(migrated.children, COMPONENTS_SYSTEM_BODY_ID)!.children ?? []
    ).findIndex((child) => child.id === TREE_ORIGIN_ID);
    const originEvents = [
      {
        type: "remove" as const,
        node: preOrigin,
        parentId: COMPONENTS_SYSTEM_BODY_ID,
        index: originIndex,
      },
      {
        type: "insert" as const,
        node: preOrigin,
        parentId: COMPONENTS_SYSTEM_BODY_ID,
        index: originIndex,
      },
    ];
    const undone = applyCanonicalHistoryEventsToDocument(
      migrated,
      originEvents,
      "undo",
    );
    expect(
      (find(undone.children, TREE_ORIGIN_ID)!.children ?? []).map(
        (child) => child.type,
      ),
    ).toEqual(["ref", "ref"]);

    // 사용자 삭제 (239 전 기록) — Undo 가 plain Tree 를 되살리면 이관된 모양으로.
    const plainTree = {
      id: "ut2",
      type: "Tree",
      props: { "aria-label": "T2" },
      children: [
        {
          id: "ut2-a",
          type: "TreeItem",
          props: { children: "A" },
          children: [
            { id: "ut2-b", type: "TreeItem", props: { children: "B" } },
          ],
        },
      ],
    } as unknown as CanonicalNode;
    const restored = applyCanonicalHistoryEventsToDocument(
      migrated,
      [{ type: "remove", node: plainTree, parentId: "body-home", index: 0 }],
      "undo",
    );
    const tree = find(restored.children, "ut2")!;
    expect((tree.children ?? []).map((child) => child.type)).toEqual(["ref"]);
    expect(tree.props?.expandedKeys).toEqual(["ut2-a"]);
  });
});
