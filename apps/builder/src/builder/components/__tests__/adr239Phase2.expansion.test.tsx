import { act, cleanup, fireEvent, render } from "@testing-library/react";
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
import {
  flattenTreeRows,
  isTreeItemExpanded,
  type TreeRowNode,
} from "../../workspace/canvas/treeItemRow";
import { pickBuilderSyncedProps } from "../../../preview/messaging/builderPropSync";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes } from "../staticCollectionMigration";
import {
  TREE_ITEM_DEFAULT_ORIGIN_ID,
  TREE_ORIGIN_ID,
} from "../tree/treeTemplateOrigins";

/**
 * ADR-239 Phase 2 — 펼침 두 leg 대칭 (breakdown §4 Phase 2 · G2): 정본 = Tree `expandedKeys` · 239 전 문서 이관 (부재 ·
 * `[]` + 중첩 → 부모 key 전부, 이관 pass 에서만) · Preview 토글 역전파.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

const item = (
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

/** `A > B > D` · `C` — 부모 항목 A · B. */
const legacyTree = (props: Record<string, unknown>): CanonicalNode =>
  ({
    id: "t",
    type: "Tree",
    props,
    children: [
      item("a", "A", [item("b", "B", [item("d", "D")])]),
      item("c", "C"),
    ],
  }) as unknown as CanonicalNode;

function canvasRows(doc: CompositionDocument, treeId: string): string[] {
  const model = buildCanonicalSceneModel(doc);
  const kids = (id: string) =>
    (model.sceneChildrenByParent.get(id) ?? []) as TreeRowNode[];
  return flattenTreeRows(kids(treeId), kids, (node) =>
    isTreeItemExpanded(node, model.sceneNodesMap as never),
  ).map((row) => row.id.split("/").pop()!);
}

const expandedOf = (doc: CompositionDocument, id: string) =>
  (indexNodes(doc).get(id)!.props as Record<string, unknown>).expandedKeys;

describe("ADR-239 Phase 2 — 239 전 문서 펼침 이관", () => {
  it("부재 · `[]` + 중첩 → 부모 항목 key 전부 (새 key — 중첩 부모는 부모 key 접두) · Canvas 행 집합 = 239 전 (전부)", () => {
    for (const props of [{}, { expandedKeys: [] }]) {
      const doc = seededDoc([legacyTree(props)]);
      expect(expandedOf(doc, "t"), JSON.stringify(props)).toEqual(["a", "a/b"]);
      expect(canvasRows(doc, "t")).toEqual(["a", "b", "d", "c"]);
    }
  });

  it("비어 있지 않은 `expandedKeys` 는 저작 값 — 보존 (key 대응만) · 접힌 항목의 자식 행 제외", () => {
    const doc = seededDoc([legacyTree({ expandedKeys: ["a"] })]);
    expect(expandedOf(doc, "t")).toEqual(["a"]);
    expect(canvasRows(doc, "t")).toEqual(["a", "b", "c"]);
  });

  it("이관을 지난 Tree 의 `[]` (사용자가 전부 접음) 는 다시 채우지 않는다 — 1회", () => {
    const migrated = seededDoc([legacyTree({})]);
    const collapsedAll = {
      ...migrated,
      children: migrated.children.map(function visit(
        node: CanonicalNode,
      ): CanonicalNode {
        if (node.id === "t") {
          return { ...node, props: { ...node.props, expandedKeys: [] } };
        }
        return node.children
          ? { ...node, children: node.children.map(visit) }
          : node;
      }),
    } as CompositionDocument;
    const again = ensureReusableCompositeOrigins(collapsedAll);
    expect(expandedOf(again, "t")).toEqual([]);
    expect(canvasRows(again, "t")).toEqual(["a", "c"]);
  });

  it("중첩 없는 Tree 는 `expandedKeys` 를 쓰지 않는다", () => {
    const doc = seededDoc([
      {
        id: "flat",
        type: "Tree",
        props: { expandedKeys: [] },
        children: [item("x", "X"), item("y", "Y")],
      } as unknown as CanonicalNode,
    ]);
    expect(expandedOf(doc, "flat")).toEqual([]);
  });

  it("Tree instance — 자기 `[]` 는 origin 의 채운 값으로 · 자기 중첩 항목 부모도 더한다", () => {
    const originDoc = (instanceProps: Record<string, unknown>) =>
      seededDoc([
        {
          ...legacyTree({}),
          id: "my-tree",
          reusable: true,
        } as CanonicalNode,
        {
          id: "inst",
          type: "ref",
          ref: "my-tree",
          props: instanceProps,
          children: [item("own", "Own", [item("own-child", "Own child")])],
        } as unknown as CanonicalNode,
      ]);
    const doc = originDoc({ expandedKeys: [] });
    expect(expandedOf(doc, "my-tree")).toEqual(["a", "a/b"]);
    expect(expandedOf(doc, "inst")).toEqual(["a", "a/b", "own"]);
    expect(canvasRows(doc, "inst")).toEqual([
      "a",
      "b",
      "d",
      "c",
      "own",
      "own-child",
    ]);
  });

  it("Components Tree origin (새 문서) instance — origin 펼침 상속", () => {
    const doc = seededDoc([
      { id: "ti", type: "ref", ref: TREE_ORIGIN_ID, props: {} },
    ] as unknown as CanonicalNode[]);
    expect(canvasRows(doc, "ti")).toEqual([
      "component-tree__item-1",
      "component-tree__item-1-1",
      "component-tree__item-2",
    ]);
  });
});

describe("ADR-239 Phase 2 — Preview 펼침 토글 역전파", () => {
  it("`expandedKeys` 는 builder 로 올라간다 (선택 key 는 범위 밖)", () => {
    expect(
      pickBuilderSyncedProps({
        expandedKeys: ["a"],
        selectedKeys: ["b"],
        "aria-label": "T",
      }),
    ).toEqual({ expandedKeys: ["a"] });
  });
});
// ───────────────────────────── 두 leg — 접힘 층 · Preview chevron 역전파 ─────────────────────────────

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const RED = "#ff0000";
const RED_RGB = "rgb(255, 0, 0)";

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

function renderTreeInstance(
  doc: CompositionDocument,
  id: string,
  updateElementProps: (
    id: string,
    props: Record<string, unknown>,
  ) => void = () => {},
) {
  const node = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
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
          updateElementProps,
        } as unknown as RenderContext
      }
    />,
  );
}

/** Tree origin instance + `--collapsed` 변형에 글자색 patch. */
function collapsedLayerDoc(): CompositionDocument {
  const doc = seededDoc([
    { id: "ti", type: "ref", ref: TREE_ORIGIN_ID, props: {} },
  ] as unknown as CanonicalNode[]);
  const variantId = `${TREE_ITEM_DEFAULT_ORIGIN_ID}--collapsed`;
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) =>
      node.id === variantId
        ? ({
            ...node,
            props: { isExpanded: false, style: { color: RED } },
          } as CanonicalNode)
        : node.children
          ? { ...node, children: visit(node.children) }
          : node,
    );
  return { ...doc, children: visit(doc.children) };
}

describe("ADR-239 Phase 2 — 접힘 층 (RAC isExpanded) · Preview 토글", () => {
  it("`--collapsed` 층은 펼친 부모 행에는 없고 잎 · 접힌 행에 — 두 leg 같은 행", () => {
    const doc = collapsedLayerDoc();
    const model = buildCanonicalSceneModel(doc);
    const canvasRed = (id: string) =>
      (model.sceneNodesMap.get(id)?.props?.style as Record<string, unknown>)
        ?.color === RED;
    expect(canvasRed("ti/component-tree__item-1")).toBe(false);
    expect(
      canvasRed("ti/component-tree__item-1/component-tree__item-1-1"),
    ).toBe(true);
    expect(canvasRed("ti/component-tree__item-2")).toBe(true);

    const { container } = renderTreeInstance(doc, "ti");
    const rows = [
      ...container.querySelectorAll<HTMLElement>('[role="row"]'),
    ].map((row) => [row.getAttribute("data-key"), row.style.color === RED_RGB]);
    expect(rows).toEqual([
      ["item-1", false],
      ["item-1/item-1-1", true],
      ["item-2", true],
    ]);
  });

  it("Preview chevron 클릭 → `updateElementProps` 에 `expandedKeys` (builder 역전파 대상)", () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const doc = seededDoc([
      { id: "ti", type: "ref", ref: TREE_ORIGIN_ID, props: {} },
    ] as unknown as CanonicalNode[]);
    const { container } = renderTreeInstance(doc, "ti", (id, props) =>
      calls.push([id, props]),
    );
    const row = container.querySelector<HTMLElement>('[data-key="item-1"]')!;
    const chevron = row.querySelector<HTMLElement>('[slot="chevron"]')!;
    act(() => {
      fireEvent.pointerDown(chevron, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(chevron, { pointerType: "mouse", button: 0 });
      fireEvent.click(chevron);
    });
    const last = calls.at(-1);
    expect(last?.[0]).toBe("ti");
    expect(pickBuilderSyncedProps(last?.[1])).toEqual({ expandedKeys: [] });
  });
});
