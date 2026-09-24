import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";

import {
  buildCanonicalSceneModel,
  resetSceneRefResolutionReuse,
} from "../../workspace/canvas/scene/canonicalSceneModel";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { TREE_ITEM_DEFAULT_ORIGIN_ID } from "../tree/treeTemplateOrigins";

/**
 * ADR-239 G5 — TreeItem instance 해석 재사용 (자기 자식 있는 항목 포함) 과 깊은 Tree 의 소속 Tree 조회.
 * - 재사용: 편집하지 않은 Tree 의 항목은 이전 해석 결과 그대로 · 편집한 Tree (선택 key · 항목 props) 는 다시 해석.
 * - 깊이: 소속 Tree 가 조상 3 단계 밖인 항목 (5 단계) 도 선택 · 접힘 층 — Preview RAC 는 깊이 제한이 없다.
 */

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => resetSceneRefResolutionReuse());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetSceneRefResolutionReuse();
});

const RED = "#ff0000";

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

/** `a > b > c > d > e` · `x` (5 단계) */
const deepTree = (id: string): CanonicalNode =>
  ({
    id,
    type: "Tree",
    props: { "aria-label": id, selectionMode: "single" },
    children: [
      item(`${id}-a`, "A", [
        item(`${id}-b`, "B", [
          item(`${id}-c`, "C", [item(`${id}-d`, "D", [item(`${id}-e`, "E")])]),
        ]),
      ]),
      item(`${id}-x`, "X"),
    ],
  }) as unknown as CanonicalNode;

function seededDoc(user: CanonicalNode[]): CompositionDocument {
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

function patchProps(
  doc: CompositionDocument,
  id: string,
  patch: Record<string, unknown>,
): CompositionDocument {
  return { ...doc, children: mapShared(doc.children, id, (node) => ({
    ...node,
    props: { ...node.props, ...patch },
  } as CanonicalNode)) };
}

/** 대상 경로만 새 객체 (store 편집과 같은 구조 공유 — 다른 subtree 는 같은 객체). */
function mapShared(
  nodes: readonly CanonicalNode[],
  id: string,
  update: (node: CanonicalNode) => CanonicalNode,
): CanonicalNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === id) {
      changed = true;
      return update(node);
    }
    if (!node.children) return node;
    const children = mapShared(node.children, id, update);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : (nodes as CanonicalNode[]);
}

const E_KEY = "t1-a/t1-b/t1-c/t1-d/t1-e";

const sceneProps = (
  model: ReturnType<typeof buildCanonicalSceneModel>,
  id: string,
) => (model.sceneNodesMap.get(id)?.props ?? {}) as Record<string, unknown>;

/** Canvas 선택 = origin (selected) · 안 된 항목 = `--unselected` 층 — 그 층에 글자색을 두고 읽는다. */
const withUnselectedRed = (doc: CompositionDocument) =>
  patchProps(doc, `${TREE_ITEM_DEFAULT_ORIGIN_ID}--unselected`, {
    style: { color: RED },
  });

const unselected = (
  model: ReturnType<typeof buildCanonicalSceneModel>,
  id: string,
) =>
  (sceneProps(model, id).style as Record<string, unknown> | undefined)
    ?.color === RED;

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

describe("ADR-239 G5 — 깊은 Tree (소속 Tree 가 조상 3 단계 밖)", () => {
  it("5 단계 항목 선택 — Canvas 선택 층 · Preview 같은 key 의 행 선택", () => {
    const doc = patchProps(withUnselectedRed(seededDoc([deepTree("t1")])), "t1", {
      selectedKeys: [E_KEY],
    });
    const model = buildCanonicalSceneModel(doc);
    expect(unselected(model, "t1-e")).toBe(false);
    expect(unselected(model, "t1-x")).toBe(true);

    const node = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "t1",
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
    const row = container.querySelector(`[data-key="${E_KEY}"]`);
    expect(row?.getAttribute("aria-selected")).toBe("true");
  });

  it("5 단계 잎 항목에 접힘 층 (`--collapsed`) — 펼친 부모에는 없음", () => {
    const variantId = `${TREE_ITEM_DEFAULT_ORIGIN_ID}--collapsed`;
    const doc = patchProps(seededDoc([deepTree("t1")]), variantId, {
      isExpanded: false,
      style: { color: RED },
    });
    const model = buildCanonicalSceneModel(doc);
    const red = (id: string) =>
      (sceneProps(model, id).style as Record<string, unknown> | undefined)
        ?.color === RED;
    expect(red("t1-e")).toBe(true);
    expect(red("t1-d")).toBe(false);
    expect(red("t1-x")).toBe(true);
  });
});

describe("ADR-239 G5 — TreeItem instance 해석 재사용", () => {
  it("다른 Tree 편집 — 편집 안 한 Tree 의 부모 항목 (자기 자식 있음) 은 이전 해석 결과 그대로", () => {
    const doc0 = seededDoc([deepTree("t1"), deepTree("t2")]);
    const first = buildCanonicalSceneModel(doc0);
    const doc1 = patchProps(doc0, "t1", { style: { paddingTop: 6 } });
    const second = buildCanonicalSceneModel(doc1);
    expect(second.sceneNodesMap.get("t2-a")).toBe(
      first.sceneNodesMap.get("t2-a"),
    );
    expect(second.sceneNodesMap.get("t2-d")).toBe(
      first.sceneNodesMap.get("t2-d"),
    );
  });

  it("소속 Tree 선택 key 편집 — 5 단계 항목도 다시 해석 (재사용이 선택을 묵히지 않는다)", () => {
    const doc0 = withUnselectedRed(seededDoc([deepTree("t1"), deepTree("t2")]));
    expect(unselected(buildCanonicalSceneModel(doc0), "t1-e")).toBe(true);
    const doc1 = patchProps(doc0, "t1", { selectedKeys: [E_KEY] });
    const m1 = buildCanonicalSceneModel(doc1);
    expect(unselected(m1, "t1-e")).toBe(false);
    const doc2 = patchProps(doc1, "t1", { selectedKeys: ["t1-x"] });
    const m2 = buildCanonicalSceneModel(doc2);
    expect(unselected(m2, "t1-e")).toBe(true);
    expect(unselected(m2, "t1-x")).toBe(false);
  });

  it("부모 항목 자기 props 편집 · 잎에 자식 추가 — 그 항목 다시 해석", () => {
    const doc0 = seededDoc([deepTree("t1")]);
    buildCanonicalSceneModel(doc0);
    const doc1 = patchProps(doc0, "t1-b", { isDisabled: true });
    const m1 = buildCanonicalSceneModel(doc1);
    expect(sceneProps(m1, "t1-b").isDisabled).toBe(true);

    const addChild = (node: CanonicalNode) =>
      ({
        ...node,
        children: [
          ...(node.children ?? []),
          {
            id: "t1-x-new",
            type: "ref",
            ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
            props: {},
          },
        ],
      }) as CanonicalNode;
    const doc2 = {
      ...doc1,
      children: mapShared(doc1.children, "t1-x", addChild),
    };
    const m2 = buildCanonicalSceneModel(doc2);
    expect(
      (m2.sceneChildrenByParent.get("t1-x") ?? []).map((n) => n.id),
    ).toContain("t1-x-new");
  });
});
