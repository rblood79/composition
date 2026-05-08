// @vitest-environment node
import { describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "@/adapters/canonical/frameMirror";
import type { Element } from "../../../../../types/core/store.types";
import type { SceneStructureSnapshot } from "../../scene";
import { buildFrameRendererInput } from "../rendererInput";
import type { CanonicalFrameElementScope } from "../../../../../adapters/canonical/frameElementScope";

type ElementFixtureOptions = Partial<Element> & {
  frameId?: string | null;
};

const makeElement = ({
  frameId = null,
  ...overrides
}: ElementFixtureOptions): Element =>
  withFrameElementMirrorId(
    {
      id: "el-1",
      type: "div",
      parent_id: null,
      page_id: null,
      order_num: 0,
      props: {},
      ...overrides,
    } as Element,
    frameId,
  );

const makeSceneSnapshot = (
  overrides: Partial<SceneStructureSnapshot> = {},
): SceneStructureSnapshot => ({
  depthMap: new Map(),
  document: {
    allPageFrames: [],
    allPageFrameVersion: 0,
    currentPageId: null,
    currentPageSnapshot: null,
    pageCount: 0,
    visibleContentVersion: 0,
    visiblePageFrames: [],
    visiblePageIds: new Set(),
    visiblePagePositionVersion: 0,
  },
  layoutVersion: 0,
  pageSnapshots: new Map(),
  sceneVersion: 0,
  source: "canonical",
  viewportVersion: 0,
  ...overrides,
});

const baseOptions = {
  dirtyElementIds: new Set<string>(),
  pagePositionVersion: 0,
  panOffset: { x: 0, y: 0 },
  wasmLayoutReady: true,
  zoom: 1,
};

function makeFrameScope(
  partial: Partial<CanonicalFrameElementScope> & {
    elementIds?: string[];
    frameId: string;
  },
): CanonicalFrameElementScope {
  return {
    bodyElementId: null,
    ...partial,
    elementIds: new Set(partial.elementIds ?? []),
  };
}

describe("ADR-111 P3-δ fix #3 — buildFrameRendererInput", () => {
  it("frame body element 부재 시 null 반환", () => {
    const elementById = new Map<string, Element>();
    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({ frameId: "frame-A" }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });
    expect(result).toBeNull();
  });

  it("canonical frame scope 의 body + subtree 로 pageElements 를 구성한다", () => {
    const body = makeElement({
      id: "frame-body-A",
      type: "body",
      frameId: "frame-A",
    });
    const slot1 = makeElement({
      id: "slot-1",
      type: "Slot",
      parent_id: "frame-body-A",
      frameId: "frame-A",
    });
    const slot2 = makeElement({
      id: "slot-2",
      type: "Slot",
      parent_id: "frame-body-A",
      frameId: "frame-A",
    });
    const otherFrameBody = makeElement({
      id: "other-body",
      type: "body",
      frameId: "frame-B",
    });

    const elementById = new Map<string, Element>([
      [body.id, body],
      [slot1.id, slot1],
      [slot2.id, slot2],
      [otherFrameBody.id, otherFrameBody],
    ]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 844,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: body.id,
        elementIds: [body.id, slot1.id, slot2.id],
      }),
      frameWidth: 390,
      frameX: 470,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result).not.toBeNull();
    expect(result!.bodyElement).toBe(body);
    // pageElements 는 body 제외 (page 경로 nonBodyElements 와 동일 정책 — fix #3 회귀 방지)
    expect(result!.pageElements).toHaveLength(2);
    expect(result!.pageElements.map((el) => el.id).sort()).toEqual([
      "slot-1",
      "slot-2",
    ]);
    // body 자체와 다른 frame 의 body 는 모두 pageElements 에서 제외
    expect(
      result!.pageElements.find((el) => el.id === "frame-body-A"),
    ).toBeUndefined();
    expect(
      result!.pageElements.find((el) => el.id === "other-body"),
    ).toBeUndefined();
  });

  it("pageWidth/pageHeight = frameWidth/frameHeight 매핑", () => {
    const body = makeElement({
      id: "frame-body",
      type: "body",
      frameId: "frame-A",
    });
    const elementById = new Map([[body.id, body]]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 600,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: body.id,
        elementIds: [body.id],
      }),
      frameWidth: 400,
      frameX: 100,
      frameY: 50,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result!.pageWidth).toBe(400);
    expect(result!.pageHeight).toBe(600);
    expect(result!.pageId).toBe("frame-A");
    expect(result!.pageSnapshot.frame).toEqual(
      expect.objectContaining({
        x: 100,
        y: 50,
        width: 400,
        height: 600,
      }),
    );
  });

  it("scope 에 Slot 만 있고 bodyElementId 가 없으면 null — fix #1 동일 원칙", () => {
    const slot = makeElement({
      id: "slot-orphan",
      type: "Slot",
      frameId: "frame-A",
    });
    const elementById = new Map([[slot.id, slot]]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        elementIds: [slot.id],
      }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result).toBeNull();
  });

  it("bodyElementId 가 body type 이 아니면 null 반환", () => {
    const slot = makeElement({
      id: "slot-as-body",
      type: "Slot",
      frameId: "frame-A",
    });
    const elementById = new Map([[slot.id, slot]]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: slot.id,
        elementIds: [slot.id],
      }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result).toBeNull();
  });

  it("canonical frame scope 밖의 element 는 frame authoring input 에 포함하지 않는다", () => {
    const body = makeElement({
      id: "frame-body",
      type: "body",
      page_id: null,
      frameId: "frame-A",
    });
    const pageElement = makeElement({
      id: "page-card",
      type: "Card",
      page_id: "page-1",
      frameId: "frame-A",
      parent_id: "frame-body",
    });
    const elementById = new Map([
      [body.id, body],
      [pageElement.id, pageElement],
    ]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: body.id,
        elementIds: [body.id],
      }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result).not.toBeNull();
    expect(result!.bodyElement).toBe(body);
    expect(result!.pageElements.map((el) => el.id)).toEqual([]);
  });

  it("deleted element 는 frame authoring input 에 포함하지 않는다", () => {
    const body = makeElement({
      id: "frame-body",
      type: "body",
      page_id: null,
      frameId: "frame-A",
    });
    const deletedSlot = makeElement({
      id: "deleted-slot",
      type: "Slot",
      parent_id: "frame-body",
      frameId: "frame-A",
      deleted: true,
    });
    const elementById = new Map([
      [body.id, body],
      [deletedSlot.id, deletedSlot],
    ]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: body.id,
        elementIds: [body.id, deletedSlot.id],
      }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result).not.toBeNull();
    expect(result!.pageElements.map((el) => el.id)).toEqual([]);
  });

  it("scope bodyElementId 가 지정한 body 를 등록하고 body type 들은 pageElements 에서 제외", () => {
    const body1 = makeElement({
      id: "body-1",
      type: "body",
      frameId: "frame-A",
    });
    const body2 = makeElement({
      id: "body-2",
      type: "body",
      frameId: "frame-A",
    });
    const elementById = new Map([
      [body1.id, body1],
      [body2.id, body2],
    ]);

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: body1.id,
        elementIds: [body1.id, body2.id],
      }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot: makeSceneSnapshot(),
    });

    expect(result!.bodyElement).toBe(body1);
    // body type 은 모두 pageElements 에서 제외 (self-child 회귀 방지)
    expect(result!.pageElements).toHaveLength(0);
  });

  it("sceneSnapshot 의 depthMap / layoutVersion 전파", () => {
    const body = makeElement({
      id: "frame-body",
      type: "body",
      frameId: "frame-A",
    });
    const elementById = new Map([[body.id, body]]);

    const depthMap = new Map([[body.id, 1]]);
    const sceneSnapshot = makeSceneSnapshot({
      depthMap,
      layoutVersion: 42,
    });

    const result = buildFrameRendererInput({
      ...baseOptions,
      elementById,
      frameHeight: 200,
      frameId: "frame-A",
      frameElementScope: makeFrameScope({
        frameId: "frame-A",
        bodyElementId: body.id,
        elementIds: [body.id],
      }),
      frameWidth: 320,
      frameX: 0,
      frameY: 0,
      sceneSnapshot,
    });

    expect(result!.depthMap).toBe(depthMap);
    expect(result!.layoutVersion).toBe(42);
  });
});
