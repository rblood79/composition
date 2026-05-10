// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Page } from "../../../../../types/core/store.types";
import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { ScenePageSnapshot, SceneStructureSnapshot } from "../../scene";
import { toPageFrameElementId } from "../../scene/resolvePageWithFrame";
import { createSkiaRendererInput } from "../rendererInput";

const makePage = (id: string): Page => ({
  id,
  project_id: "project-1",
  slug: id,
  title: id,
});

const makeSceneNode = (
  partial: Partial<CanvasSceneNode> & { id: string; type: string },
): CanvasSceneNode => {
  const props = partial.props ?? {};
  const parentId = partial.parentId ?? partial.parent_id ?? null;
  const pageId = partial.pageId ?? partial.page_id ?? "page-1";
  const layoutId = partial.layoutId ?? partial.layout_id ?? null;
  return {
    props,
    parentId,
    pageId,
    layoutId,
    parent_id: parentId,
    page_id: pageId,
    layout_id: layoutId,
    sourceNode: {
      id: partial.id,
      type: partial.type as CanvasSceneNode["sourceNode"]["type"],
      props,
    },
    ...partial,
  };
};

function buildChildrenByParent(
  nodes: CanvasSceneNode[],
): Map<string, CanvasSceneNode[]> {
  const map = new Map<string, CanvasSceneNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId ?? node.parent_id ?? null;
    if (!parentId) continue;
    const children = map.get(parentId);
    if (children) {
      children.push(node);
    } else {
      map.set(parentId, [node]);
    }
  }
  return map;
}

function makeSceneGraphInput(nodes: CanvasSceneNode[]): {
  sceneChildrenByParent: Map<string, CanvasSceneNode[]>;
  sceneNodes: CanvasSceneNode[];
  sceneNodesMap: Map<string, CanvasSceneNode>;
} {
  return {
    sceneChildrenByParent: buildChildrenByParent(nodes),
    sceneNodes: nodes,
    sceneNodesMap: new Map(nodes.map((node) => [node.id, node] as const)),
  };
}

function makeSceneSnapshot(
  pageSnapshots: Map<string, ScenePageSnapshot>,
): SceneStructureSnapshot {
  const visiblePageIds = new Set(pageSnapshots.keys());
  return {
    depthMap: new Map(),
    document: {
      allPageFrames: [],
      allPageFrameVersion: 1,
      currentPageId: pageSnapshots.keys().next().value ?? null,
      currentPageSnapshot: pageSnapshots.values().next().value ?? null,
      pageCount: pageSnapshots.size,
      visibleContentVersion: 1,
      visiblePageFrames: [],
      visiblePageIds,
      visiblePagePositionVersion: 1,
    },
    layoutVersion: 1,
    pageSnapshots,
    sceneVersion: 1,
    source: "canonical",
    viewportVersion: 1,
  };
}

describe("createSkiaRendererInput", () => {
  it("merges page-resolved frame projections before canonical tree resolution", () => {
    const page1Body = makeSceneNode({
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeSceneNode({
      id: "page-2-body",
      type: "body",
      page_id: "page-2",
    });
    const page1Fill = makeSceneNode({
      id: "page-1-fill",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-1-body",
    });
    const page2Fill = makeSceneNode({
      id: "page-2-fill",
      type: "Button",
      page_id: "page-2",
      parent_id: "page-2-body",
    });
    const page1Slot = makeSceneNode({
      id: toPageFrameElementId("page-1", "slot-content"),
      type: "Slot",
      page_id: "page-1",
      parent_id: "page-1-body",
    });
    const page2Slot = makeSceneNode({
      id: toPageFrameElementId("page-2", "slot-content"),
      type: "Slot",
      page_id: "page-2",
      parent_id: "page-2-body",
    });
    const page1ResolvedFill = makeSceneNode({
      ...page1Fill,
      parentId: page1Slot.id,
      parent_id: page1Slot.id,
    });
    const page2ResolvedFill = makeSceneNode({
      ...page2Fill,
      parentId: page2Slot.id,
      parent_id: page2Slot.id,
    });
    const elements = [page1Body, page2Body, page1Fill, page2Fill];
    const elementsMap = new Map(elements.map((el) => [el.id, el]));
    const sceneSnapshot = makeSceneSnapshot(
      new Map([
        [
          "page-1",
          {
            bodyElement: page1Body,
            contentVersion: 1,
            frame: {
              elementCount: 2,
              height: 800,
              id: "page-1",
              title: "page-1",
              width: 400,
              x: 0,
              y: 0,
            },
            isVisible: true,
            pageElements: [page1Slot, page1ResolvedFill],
            pageId: "page-1",
            positionVersion: 1,
          },
        ],
        [
          "page-2",
          {
            bodyElement: page2Body,
            contentVersion: 1,
            frame: {
              elementCount: 2,
              height: 800,
              id: "page-2",
              title: "page-2",
              width: 400,
              x: 0,
              y: 820,
            },
            isVisible: true,
            pageElements: [page2Slot, page2ResolvedFill],
            pageId: "page-2",
            positionVersion: 1,
          },
        ],
      ]),
    );

    const input = createSkiaRendererInput({
      childrenMap: new Map([
        ["page-1-body", [page1Fill]],
        ["page-2-body", [page2Fill]],
      ]),
      dirtyElementIds: new Set(),
      editMode: "page",
      elements,
      elementsMap,
      frameAreas: [],
      framePositions: {},
      framePositionsVersion: 1,
      frameElementScopes: new Map(),
      pageIndex: { elementsByPage: new Map(), rootsByPage: new Map() },
      pagePositions: {},
      pagePositionsVersion: 1,
      pages: [makePage("page-1"), makePage("page-2")],
      ...makeSceneGraphInput(elements),
      sceneSnapshot,
    });

    expect(input.elementsMap.get("page-1-fill")?.parent_id).toBe(page1Slot.id);
    expect(input.elementsMap.get("page-2-fill")?.parent_id).toBe(page2Slot.id);
    expect(input.childrenMap.get(page1Slot.id)?.map((el) => el.id)).toEqual([
      "page-1-fill",
    ]);
    expect(input.childrenMap.get(page2Slot.id)?.map((el) => el.id)).toEqual([
      "page-2-fill",
    ]);
  });

  it("builds childrenMap from page snapshot source order instead of legacy order_num", () => {
    const body = makeSceneNode({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const first = makeSceneNode({
      id: "first",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
    });
    const second = makeSceneNode({
      id: "second",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
    });
    const sceneSnapshot = makeSceneSnapshot(
      new Map([
        [
          "page-1",
          {
            bodyElement: body,
            contentVersion: 1,
            frame: {
              elementCount: 2,
              height: 800,
              id: "page-1",
              title: "page-1",
              width: 400,
              x: 0,
              y: 0,
            },
            isVisible: true,
            pageElements: [second, first],
            pageId: "page-1",
            positionVersion: 1,
          },
        ],
      ]),
    );

    const input = createSkiaRendererInput({
      childrenMap: new Map([[body.id, [first, second]]]),
      dirtyElementIds: new Set(),
      editMode: "page",
      elements: [body, first, second],
      elementsMap: new Map([
        [body.id, body],
        [first.id, first],
        [second.id, second],
      ]),
      frameAreas: [],
      framePositions: {},
      framePositionsVersion: 1,
      frameElementScopes: new Map(),
      pageIndex: { elementsByPage: new Map(), rootsByPage: new Map() },
      pagePositions: {},
      pagePositionsVersion: 1,
      pages: [makePage("page-1")],
      ...makeSceneGraphInput([body, first, second]),
      sceneSnapshot,
    });

    expect(input.childrenMap.get(body.id)?.map((el) => el.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("resolves canonical scene graph refs without using the legacy Element scene fallback", () => {
    const body = makeSceneNode({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const sceneBody = makeSceneNode({
      id: body.id,
      type: body.type,
      props: body.props,
    });
    const origin = makeSceneNode({
      id: "origin-card",
      type: "Card",
      props: { style: { color: "red" } },
      reusable: true,
      name: "OriginCard",
      componentName: "OriginCard",
    });
    const originLabel = makeSceneNode({
      id: "origin-label",
      type: "Text",
      props: { children: "Base" },
      parentId: origin.id,
      parent_id: origin.id,
    });
    const instance = makeSceneNode({
      id: "instance-card",
      type: "ref",
      props: { style: { backgroundColor: "blue" } },
      parentId: body.id,
      parent_id: body.id,
      ref: origin.id,
    });
    const sceneChildrenByParent = new Map<string, CanvasSceneNode[]>([
      [body.id, [instance]],
      [origin.id, [originLabel]],
    ]);
    const sceneNodes = [sceneBody, origin, originLabel, instance];
    const sceneNodesMap = new Map(sceneNodes.map((node) => [node.id, node]));

    const input = createSkiaRendererInput({
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      editMode: "page",
      elements: [body],
      elementsMap: new Map([[body.id, body]]),
      frameAreas: [],
      framePositions: {},
      framePositionsVersion: 1,
      frameElementScopes: new Map(),
      pageIndex: { elementsByPage: new Map(), rootsByPage: new Map() },
      pagePositions: {},
      pagePositionsVersion: 1,
      pages: [makePage("page-1")],
      sceneChildrenByParent,
      sceneNodes,
      sceneNodesMap,
      sceneSnapshot: makeSceneSnapshot(new Map()),
    });

    const resolvedInstance = input.sceneNodesMap.get(instance.id);
    expect(resolvedInstance?.type).toBe("Card");
    expect(resolvedInstance?.props).toEqual({
      style: { backgroundColor: "blue", color: "red" },
    });
    expect(
      input.sceneNodesMap.get("instance-card/origin-label")?.parentId,
    ).toBe(instance.id);
    expect(
      input.sceneChildrenByParent.get(instance.id)?.map((child) => child.id),
    ).toEqual(["instance-card/origin-label"]);
  });
});
