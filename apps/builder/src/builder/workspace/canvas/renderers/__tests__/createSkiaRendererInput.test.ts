// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Element, Page } from "../../../../../types/core/store.types";
import type { ScenePageSnapshot, SceneStructureSnapshot } from "../../scene";
import { toPageFrameElementId } from "../../scene/resolvePageWithFrame";
import { createSkiaRendererInput } from "../rendererInput";

const makeEl = (
  partial: Partial<Element> & { id: string; type: string },
): Element => ({
  props: {},
  ...partial,
});

const makePage = (id: string): Page => ({
  id,
  project_id: "project-1",
  slug: id,
  title: id,
});

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
    const page1Body = makeEl({
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeEl({
      id: "page-2-body",
      type: "body",
      page_id: "page-2",
    });
    const page1Fill = makeEl({
      id: "page-1-fill",
      type: "Card",
      page_id: "page-1",
      parent_id: "page-1-body",
    });
    const page2Fill = makeEl({
      id: "page-2-fill",
      type: "Button",
      page_id: "page-2",
      parent_id: "page-2-body",
    });
    const page1Slot = makeEl({
      id: toPageFrameElementId("page-1", "slot-content"),
      type: "Slot",
      page_id: "page-1",
      parent_id: "page-1-body",
    });
    const page2Slot = makeEl({
      id: toPageFrameElementId("page-2", "slot-content"),
      type: "Slot",
      page_id: "page-2",
      parent_id: "page-2-body",
    });
    const page1ResolvedFill = {
      ...page1Fill,
      parent_id: page1Slot.id,
    };
    const page2ResolvedFill = {
      ...page2Fill,
      parent_id: page2Slot.id,
    };
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
    const body = makeEl({
      id: "page-body",
      type: "body",
      page_id: "page-1",
    });
    const first = makeEl({
      id: "first",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
    });
    const second = makeEl({
      id: "second",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 1,
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
      sceneSnapshot,
    });

    expect(input.childrenMap.get(body.id)?.map((el) => el.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});
