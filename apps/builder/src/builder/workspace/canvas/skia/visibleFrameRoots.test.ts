// @vitest-environment node
import { describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "@/adapters/canonical/frameMirror";
import type { SkiaRendererInput } from "../renderers";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { CanonicalFrameElementScope } from "../../../../adapters/canonical/frameElementScope";
import { collectVisibleFrameRoots } from "./visibleFrameRoots";

type ElementFixtureOptions = Partial<CanvasSceneNode> & {
  frameId?: string | null;
};

const makeElement = ({
  frameId = null,
  ...overrides
}: ElementFixtureOptions): CanvasSceneNode =>
  withFrameElementMirrorId(
    {
      id: "el-1",
      type: "div",
      parent_id: null,
      page_id: null,
      order_num: 0,
      props: {},
      ...overrides,
    } as CanvasSceneNode,
    frameId,
  );

const makeInput = (partial: Partial<SkiaRendererInput>): SkiaRendererInput => {
  const typedPartial = partial as Partial<SkiaRendererInput> & {
    elementsMap?: Map<string, CanvasSceneNode>;
    renderNodesMap?: Map<string, CanvasSceneNode>;
  };
  const elements = partial.elements ?? [];
  const elementsMap =
    typedPartial?.elementsMap ?? new Map(elements.map((el) => [el.id, el]));
  const renderNodesMap = typedPartial?.renderNodesMap ?? elementsMap;
  const sceneNodes = partial.sceneNodes ?? (elements as CanvasSceneNode[]);
  const sceneNodesMap =
    partial.sceneNodesMap ??
    new Map(sceneNodes.map((node) => [node.id, node] as const));
  return {
    childrenMap: new Map(),
    elements,
    elementsMap,
    renderNodesMap,
    sceneChildrenByParent: partial.sceneChildrenByParent ?? new Map(),
    sceneNodes,
    sceneNodesMap,
    dirtyElementIds: new Set(),
    editMode: "layout",
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
  };
};

const makeFrameScope = (
  frameId: string,
  bodyElementId: string | null,
  elementIds: string[] = bodyElementId ? [bodyElementId] : [],
): CanonicalFrameElementScope => ({
  bodyElementId,
  elementIds: new Set(elementIds),
  frameId,
});

describe("ADR-111 P3-δ collectVisibleFrameRoots", () => {
  it("page mode 에서는 selectedReusableFrameId/frameAreas 가 남아 있어도 frame roots 를 렌더하지 않는다", () => {
    const bodyEl = makeElement({
      id: "frame-body-1",
      type: "body",
      frameId: "frame-A",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        editMode: "page",
        elements: [bodyEl],
        frameAreas: [
          {
            frameId: "frame-A",
            frameName: "Frame A",
            x: 100,
            y: 50,
            width: 320,
            height: 200,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual([]);
    expect(result.bodyPagePositions).toEqual({});
  });

  it("frameAreas 비어 있으면 빈 결과 반환", () => {
    const result = collectVisibleFrameRoots(makeInput({ frameAreas: [] }));
    expect(result.rootElementIds).toEqual([]);
    expect(result.bodyPagePositions).toEqual({});
  });

  it("canonical frame scope 의 bodyElementId 가 root + frameAreas 좌표를 결정한다", () => {
    const bodyEl = makeElement({
      id: "frame-body-1",
      type: "body",
      frameId: "frame-A",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [bodyEl],
        framePositions: {
          "frame-A": { x: 999, y: 888, width: 320, height: 200 },
        },
        frameElementScopes: new Map([
          ["frame-A", makeFrameScope("frame-A", bodyEl.id)],
        ]),
        frameAreas: [
          {
            frameId: "frame-A",
            frameName: "Frame A",
            x: 100,
            y: 50,
            width: 320,
            height: 200,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual(["frame-body-1"]);
    expect(result.bodyPagePositions["frame-body-1"]).toEqual({ x: 100, y: 50 });
  });

  it("sceneNodesMap 가 아닌 renderNodesMap 의 frame body 도 root 등록한다", () => {
    const bodyEl = makeElement({
      id: "frame-body-render-only",
      type: "body",
      frameId: "frame-B",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [],
        renderNodesMap: new Map([[bodyEl.id, bodyEl]]),
        sceneNodes: [],
        sceneNodesMap: new Map(),
        frameElementScopes: new Map([
          ["frame-B", makeFrameScope("frame-B", bodyEl.id)],
        ]),
        frameAreas: [
          {
            frameId: "frame-B",
            frameName: "Frame B",
            x: 30,
            y: 40,
            width: 320,
            height: 200,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual(["frame-body-render-only"]);
    expect(result.bodyPagePositions["frame-body-render-only"]).toEqual({
      x: 30,
      y: 40,
    });
  });

  it("canonical frame scope 밖의 body 는 frame mode root 로 등록하지 않는다", () => {
    const pageBody = makeElement({
      id: "page-body",
      type: "body",
      page_id: "page-1",
      frameId: "frame-A",
    });
    const frameBody = makeElement({
      id: "frame-body",
      type: "body",
      page_id: null,
      frameId: "frame-A",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [pageBody, frameBody],
        frameElementScopes: new Map([
          ["frame-A", makeFrameScope("frame-A", frameBody.id)],
        ]),
        frameAreas: [
          {
            frameId: "frame-A",
            frameName: "Frame A",
            x: 0,
            y: 0,
            width: 320,
            height: 200,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual(["frame-body"]);
  });

  it("stale framePositions 가 있어도 정규화된 frameAreas.x/y 를 사용한다", () => {
    const bodyEl = makeElement({
      id: "frame-body-1",
      type: "body",
      frameId: "frame-A",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [bodyEl],
        framePositions: {
          "frame-A": { x: 900, y: 900, width: 320, height: 200 },
        },
        frameElementScopes: new Map([
          ["frame-A", makeFrameScope("frame-A", bodyEl.id)],
        ]),
        frameAreas: [
          {
            frameId: "frame-A",
            frameName: "Frame A",
            x: 50,
            y: 25,
            width: 0,
            height: 0,
          },
        ],
      }),
    );

    expect(result.bodyPagePositions["frame-body-1"]).toEqual({ x: 50, y: 25 });
  });

  it("frame body element 부재 시 root list 에서 제외 (silent skip)", () => {
    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [],
        frameAreas: [
          {
            frameId: "frame-orphan",
            frameName: "Orphan",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual([]);
    expect(result.bodyPagePositions).toEqual({});
  });

  it("다중 frame: body 매칭 + 좌표 매핑 보존", () => {
    const body1 = makeElement({
      id: "fb-1",
      type: "body",
      frameId: "frame-A",
    });
    const body2 = makeElement({
      id: "fb-2",
      type: "body",
      frameId: "frame-B",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [body1, body2],
        frameElementScopes: new Map([
          ["frame-A", makeFrameScope("frame-A", body1.id)],
          ["frame-B", makeFrameScope("frame-B", body2.id)],
        ]),
        framePositions: {
          "frame-A": { x: 0, y: 0, width: 320, height: 200 },
          "frame-B": { x: 400, y: 0, width: 480, height: 300 },
        },
        frameAreas: [
          {
            frameId: "frame-A",
            frameName: "A",
            x: 0,
            y: 0,
            width: 320,
            height: 200,
          },
          {
            frameId: "frame-B",
            frameName: "B",
            x: 400,
            y: 0,
            width: 480,
            height: 300,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual(["fb-1", "fb-2"]);
    expect(result.bodyPagePositions["fb-1"]).toEqual({ x: 0, y: 0 });
    expect(result.bodyPagePositions["fb-2"]).toEqual({ x: 400, y: 0 });
  });

  it("Slot 이 scope 에 있어도 bodyElementId 만 frame body 로 등록함 (P3-δ fix #1)", () => {
    const slot1 = makeElement({
      id: "slot-1",
      type: "Slot",
      parent_id: "frame-body-1",
      frameId: "frame-A",
    });
    const slot2 = makeElement({
      id: "slot-2",
      type: "Slot",
      parent_id: "frame-body-1",
      frameId: "frame-A",
    });
    const frameBody = makeElement({
      id: "frame-body-1",
      type: "body",
      frameId: "frame-A",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [slot1, slot2, frameBody], // Slot 먼저, body 마지막
        frameElementScopes: new Map([
          [
            "frame-A",
            makeFrameScope("frame-A", frameBody.id, [
              slot1.id,
              slot2.id,
              frameBody.id,
            ]),
          ],
        ]),
        framePositions: {
          "frame-A": { x: 100, y: 50, width: 320, height: 200 },
        },
        frameAreas: [
          {
            frameId: "frame-A",
            frameName: "A",
            x: 100,
            y: 50,
            width: 320,
            height: 200,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual(["frame-body-1"]);
    expect(result.bodyPagePositions["frame-body-1"]).toEqual({ x: 100, y: 50 });
    expect(result.bodyPagePositions["slot-1"]).toBeUndefined();
    expect(result.bodyPagePositions["slot-2"]).toBeUndefined();
  });

  it("body 가 여러 개 있어도 scope bodyElementId 만 root 로 등록", () => {
    const body1 = makeElement({
      id: "frame-body-A",
      type: "body",
      frameId: "frame-X",
    });
    const body1Dup = makeElement({
      id: "frame-body-A-dup",
      type: "body",
      frameId: "frame-X",
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [body1, body1Dup],
        frameElementScopes: new Map([
          [
            "frame-X",
            makeFrameScope("frame-X", body1.id, [body1.id, body1Dup.id]),
          ],
        ]),
        framePositions: {
          "frame-X": { x: 0, y: 0, width: 100, height: 100 },
        },
        frameAreas: [
          {
            frameId: "frame-X",
            frameName: "X",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual(["frame-body-A"]);
  });

  it("deleted frame body 는 live root 로 등록하지 않는다", () => {
    const deletedBody = makeElement({
      id: "deleted-body",
      type: "body",
      frameId: "frame-X",
      deleted: true,
    });

    const result = collectVisibleFrameRoots(
      makeInput({
        elements: [deletedBody],
        frameElementScopes: new Map([
          ["frame-X", makeFrameScope("frame-X", deletedBody.id)],
        ]),
        frameAreas: [
          {
            frameId: "frame-X",
            frameName: "X",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
      }),
    );

    expect(result.rootElementIds).toEqual([]);
    expect(result.bodyPagePositions).toEqual({});
  });
});
