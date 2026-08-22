// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Page } from "../../../../types/core/store.types";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ScenePageSnapshot } from "../scene";
import type { SkiaRendererInput } from "../renderers";
import { collectVisiblePageRoots } from "./visiblePageRoots";
import { EMPTY_SKIA_PRESENTATION_PROJECTION_INDEX } from "../../../presentation/skiaPresentationProjectionIndex";

const makeElement = (overrides: Partial<CanvasSceneNode>): CanvasSceneNode =>
  ({
    id: "body-1",
    type: "body",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  }) as CanvasSceneNode;

const makePage = (id = "page-1"): Page =>
  ({
    id,
    title: "Page 1",
    slug: "page-1",
    project_id: "project-1",
  }) as Page;

const makeInput = (partial: Partial<SkiaRendererInput>): SkiaRendererInput => ({
  childrenMap: new Map(),
  elements: [],
  interactionChildrenMap: new Map(),
  interactionNodesMap: new Map(),
  renderNodesMap: new Map(),
  projectionVersion: 0,
  presentationProjectionIndex: EMPTY_SKIA_PRESENTATION_PROJECTION_INDEX,
  sceneChildrenByParent: new Map(),
  sceneNodes: [],
  sceneNodesMap: new Map(),
  dirtyElementIds: new Set(),
  documentRevision: 0,
  editMode: "page",
  pageIndex: { elementsByPage: new Map() } as never,
  pagePositionsVersion: 0,
  pagePositions: {},
  pageSnapshots: new Map(),
  pages: [],
  sceneSnapshot: { document: { visiblePageIds: new Set() } } as never,
  framePositions: {},
  framePositionsVersion: 0,
  frameAreas: [],
  frameElementScopes: new Map(),
  ...partial,
});

describe("collectVisiblePageRoots edit mode isolation", () => {
  it("page mode 에서는 visible page body 를 root 로 수집한다", () => {
    const page = makePage();
    const body = makeElement({ id: "page-body" });
    const snapshot: ScenePageSnapshot = {
      bodyElement: body,
      contentVersion: 1,
      frame: {
        elementCount: 0,
        height: 844,
        id: page.id,
        title: page.title,
        width: 390,
        x: 10,
        y: 20,
      },
      isVisible: true,
      pageElements: [],
      pageId: page.id,
      positionVersion: 1,
    };

    const result = collectVisiblePageRoots(
      makeInput({
        pages: [page],
        pagePositions: { [page.id]: { x: 10, y: 20 } },
        pageSnapshots: new Map([[page.id, snapshot]]),
        sceneSnapshot: {
          document: { visiblePageIds: new Set([page.id]) },
        } as never,
      }),
    );

    expect(result.rootElementIds).toEqual(["page-body"]);
    expect(result.bodyPageIds).toEqual(new Map([["page-body", page.id]]));
    expect(result.bodyPagePositions["page-body"]).toEqual({ x: 10, y: 20 });
  });

  it("활성 페이지 body 를 마지막 root 로 배치한다 (겹침 페인트 최상단)", () => {
    const pageA = makePage("page-a");
    const pageB = makePage("page-b");
    const makeSnapshot = (page: Page, bodyId: string): ScenePageSnapshot => ({
      bodyElement: makeElement({ id: bodyId, page_id: page.id }),
      contentVersion: 1,
      frame: {
        elementCount: 0,
        height: 844,
        id: page.id,
        title: page.title,
        width: 390,
        x: 0,
        y: 0,
      },
      isVisible: true,
      pageElements: [],
      pageId: page.id,
      positionVersion: 1,
    });

    const result = collectVisiblePageRoots(
      makeInput({
        pages: [pageA, pageB],
        pagePositions: {
          [pageA.id]: { x: 0, y: 0 },
          [pageB.id]: { x: 20, y: 20 },
        },
        pageSnapshots: new Map([
          [pageA.id, makeSnapshot(pageA, "body-a")],
          [pageB.id, makeSnapshot(pageB, "body-b")],
        ]),
        sceneSnapshot: {
          document: {
            visiblePageIds: new Set([pageA.id, pageB.id]),
            currentPageId: pageA.id,
          },
        } as never,
      }),
    );

    // 문서 순서는 [A, B] 지만 활성 페이지 A 가 마지막(위에 그려짐)
    expect(result.rootElementIds).toEqual(["body-b", "body-a"]);
  });

  it("frame mode 에서는 visible page snapshot 이 남아 있어도 page roots 를 렌더하지 않는다", () => {
    const page = makePage();
    const body = makeElement({ id: "page-body" });

    const result = collectVisiblePageRoots(
      makeInput({
        editMode: "layout",
        pages: [page],
        pagePositions: { [page.id]: { x: 10, y: 20 } },
        pageSnapshots: new Map([
          [
            page.id,
            {
              bodyElement: body,
              contentVersion: 1,
              frame: {
                elementCount: 0,
                height: 844,
                id: page.id,
                title: page.title,
                width: 390,
                x: 10,
                y: 20,
              },
              isVisible: true,
              pageElements: [],
              pageId: page.id,
              positionVersion: 1,
            } satisfies ScenePageSnapshot,
          ],
        ]),
        sceneSnapshot: {
          document: { visiblePageIds: new Set([page.id]) },
        } as never,
      }),
    );

    expect(result.rootElementIds).toEqual([]);
    expect(result.bodyPagePositions).toEqual({});
  });
});
