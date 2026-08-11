import { describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { Element } from "../../../../types/core/store.types";
import {
  findBodySelectionAtCanvasPoint,
  findTopPageIdAtCanvasPoint,
  pickTopmostHitElementId,
} from "./selectionHitTest";

function makeBody(
  overrides: Partial<Element> & { frameId?: string | null },
): Element {
  const { frameId, ...elementOverrides } = overrides;
  const body = {
    id: "body",
    type: "body",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    ...elementOverrides,
  } as Element;

  return frameId === undefined ? body : withFrameElementMirrorId(body, frameId);
}

describe("findBodySelectionAtCanvasPoint", () => {
  it("selects page body for empty clicks inside a page", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        ["page-body", makeBody({ id: "page-body", page_id: "page-1" })],
      ]),
      pageHeight: 600,
      pageIndexElementsByPage: new Map([["page-1", new Set(["page-body"])]]),
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pageWidth: 800,
      pages: [{ id: "page-1" }],
    });

    expect(result).toEqual({ bodyElementId: "page-body", pageId: "page-1" });
  });

  it("selects canonical Body nodes with uppercase type for empty page clicks", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        [
          "page-body",
          makeBody({ id: "page-body", page_id: "page-1", type: "Body" }),
        ],
      ]),
      pageHeight: 600,
      pageIndexElementsByPage: new Map([["page-1", new Set(["page-body"])]]),
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pageWidth: 800,
      pages: [{ id: "page-1" }],
    });

    expect(result).toEqual({ bodyElementId: "page-body", pageId: "page-1" });
  });

  it("selects frame body before overlapping page body in frame authoring", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        ["page-body", makeBody({ id: "page-body", page_id: "page-1" })],
        [
          "frame-body",
          makeBody({
            id: "frame-body",
            frameId: "frame-1",
            page_id: null,
          }),
        ],
      ]),
      frameAreas: [{ frameId: "frame-1", x: 0, y: 0, width: 800, height: 600 }],
      pageHeight: 600,
      pageIndexElementsByPage: new Map([["page-1", new Set(["page-body"])]]),
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pageWidth: 800,
      pages: [{ id: "page-1" }],
    });

    expect(result).toEqual({ bodyElementId: "frame-body", pageId: null });
  });

  it("selects the topmost frame body when frame areas overlap", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        [
          "frame-body-a",
          makeBody({
            id: "frame-body-a",
            frameId: "frame-a",
            page_id: null,
          }),
        ],
        [
          "frame-body-b",
          makeBody({
            id: "frame-body-b",
            frameId: "frame-b",
            page_id: null,
          }),
        ],
      ]),
      frameAreas: [
        { frameId: "frame-a", x: 0, y: 0, width: 800, height: 600 },
        { frameId: "frame-b", x: 0, y: 0, width: 800, height: 600 },
      ],
      pageHeight: 600,
      pageIndexElementsByPage: new Map(),
      pagePositions: {},
      pageWidth: 800,
      pages: [],
    });

    expect(result).toEqual({ bodyElementId: "frame-body-b", pageId: null });
  });

  it("does not fall through to page body when a frame area owns the click but has no body", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        ["page-body", makeBody({ id: "page-body", page_id: "page-1" })],
      ]),
      frameAreas: [{ frameId: "frame-1", x: 0, y: 0, width: 800, height: 600 }],
      pageHeight: 600,
      pageIndexElementsByPage: new Map([["page-1", new Set(["page-body"])]]),
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pageWidth: 800,
      pages: [{ id: "page-1" }],
    });

    expect(result).toEqual({ bodyElementId: null, pageId: null });
  });

  it("겹친 페이지에서는 활성 페이지 body 가 선택된다 (문서 순서 무관)", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        ["page-body-1", makeBody({ id: "page-body-1", page_id: "page-1" })],
        ["page-body-2", makeBody({ id: "page-body-2", page_id: "page-2" })],
      ]),
      pageHeight: 600,
      pageIndexElementsByPage: new Map([
        ["page-1", new Set(["page-body-1"])],
        ["page-2", new Set(["page-body-2"])],
      ]),
      pagePositions: {
        "page-1": { x: 0, y: 0 },
        "page-2": { x: 20, y: 20 },
      },
      pageWidth: 800,
      pages: [{ id: "page-1" }, { id: "page-2" }],
    });

    expect(result).toEqual({ bodyElementId: "page-body-1", pageId: "page-1" });
  });

  it("겹친 페이지 중 활성이 아니면 문서 순서 뒤쪽(위에 그려진) 페이지가 선택된다", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 40, y: 40 },
      currentPageId: null,
      elementsMap: new Map([
        ["page-body-1", makeBody({ id: "page-body-1", page_id: "page-1" })],
        ["page-body-2", makeBody({ id: "page-body-2", page_id: "page-2" })],
      ]),
      pageHeight: 600,
      pageIndexElementsByPage: new Map([
        ["page-1", new Set(["page-body-1"])],
        ["page-2", new Set(["page-body-2"])],
      ]),
      pagePositions: {
        "page-1": { x: 0, y: 0 },
        "page-2": { x: 20, y: 20 },
      },
      pageWidth: 800,
      pages: [{ id: "page-1" }, { id: "page-2" }],
    });

    expect(result).toEqual({ bodyElementId: "page-body-2", pageId: "page-2" });
  });

  it("ignores hidden page areas when page body selection is disabled", () => {
    const result = findBodySelectionAtCanvasPoint({
      canvasPoint: { x: 840, y: 40 },
      currentPageId: "page-1",
      elementsMap: new Map([
        ["page-body-2", makeBody({ id: "page-body-2", page_id: "page-2" })],
      ]),
      pageHeight: 600,
      pageIndexElementsByPage: new Map([["page-2", new Set(["page-body-2"])]]),
      pagePositions: { "page-2": { x: 800, y: 0 } },
      pageSelectionEnabled: false,
      pageWidth: 800,
      pages: [{ id: "page-2" }],
    });

    expect(result).toEqual({ bodyElementId: null, pageId: null });
  });
});

describe("findTopPageIdAtCanvasPoint", () => {
  const geometry = {
    pageHeight: 600,
    pageWidth: 800,
    pagePositions: {
      "page-1": { x: 0, y: 0 },
      "page-2": { x: 400, y: 0 },
    },
    pages: [{ id: "page-1" }, { id: "page-2" }],
  };

  it("겹침 지점에서는 활성 페이지가 최상단", () => {
    expect(
      findTopPageIdAtCanvasPoint({
        canvasPoint: { x: 500, y: 100 },
        activePageId: "page-1",
        ...geometry,
      }),
    ).toBe("page-1");
  });

  it("활성 페이지가 지점을 안 덮으면 문서 순서 뒤쪽 페이지", () => {
    expect(
      findTopPageIdAtCanvasPoint({
        canvasPoint: { x: 900, y: 100 },
        activePageId: "page-1",
        ...geometry,
      }),
    ).toBe("page-2");
  });

  it("어느 페이지도 안 덮으면 null", () => {
    expect(
      findTopPageIdAtCanvasPoint({
        canvasPoint: { x: 2000, y: 100 },
        activePageId: "page-1",
        ...geometry,
      }),
    ).toBe(null);
  });
});

describe("pickTopmostHitElementId", () => {
  it("prefers a deeper page-slot child over its slot marker hit candidate", () => {
    const elementsMap = new Map<string, Element>([
      ["page-body", makeBody({ id: "page-body", page_id: "page-1" })],
      [
        "page::slot-content",
        {
          id: "page::slot-content",
          type: "Slot",
          page_id: "page-1",
          parent_id: "page-body",
          order_num: 0,
          props: { _slotChrome: "hidden" },
        } as Element,
      ],
      [
        "page-card",
        {
          id: "page-card",
          type: "Card",
          page_id: "page-1",
          parent_id: "page::slot-content",
          order_num: 0,
          props: {},
        } as Element,
      ],
    ]);

    expect(
      pickTopmostHitElementId(["page::slot-content", "page-card"], elementsMap),
    ).toBe("page-card");
  });

  it("uses canonical child order for overlapping siblings instead of legacy order_num", () => {
    const body = makeBody({ id: "page-body", page_id: "page-1" });
    const first = {
      id: "first",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 10,
      props: {},
    } as Element;
    const second = {
      id: "second",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
      props: {},
    } as Element;
    const elementsMap = new Map<string, Element>([
      [body.id, body],
      [first.id, first],
      [second.id, second],
    ]);

    expect(
      pickTopmostHitElementId(
        [first.id, second.id],
        elementsMap,
        new Map([[body.id, [first, second]]]),
      ),
    ).toBe(second.id);
  });

  it("페이지 간 후보는 pagePaintRank 가 1차 키 — 위에 그려진 페이지 요소가 이긴다", () => {
    // page-1 요소가 더 깊어도(깊이 tie-break 무시) rank 가 높은 page-2 요소가 이긴다
    const body1 = makeBody({ id: "page-body-1", page_id: "page-1" });
    const wrapper = {
      id: "wrapper",
      type: "Box",
      page_id: "page-1",
      parent_id: body1.id,
      order_num: 0,
      props: {},
    } as Element;
    const deepOnPage1 = {
      id: "deep-on-page-1",
      type: "Box",
      page_id: "page-1",
      parent_id: wrapper.id,
      order_num: 0,
      props: {},
    } as Element;
    const body2 = makeBody({ id: "page-body-2", page_id: "page-2" });
    const shallowOnPage2 = {
      id: "shallow-on-page-2",
      type: "Box",
      page_id: "page-2",
      parent_id: body2.id,
      order_num: 0,
      props: {},
    } as Element;
    const elementsMap = new Map<string, Element>([
      [body1.id, body1],
      [wrapper.id, wrapper],
      [deepOnPage1.id, deepOnPage1],
      [body2.id, body2],
      [shallowOnPage2.id, shallowOnPage2],
    ]);

    // page-2 가 활성(rank 최고) — 얕아도 page-2 요소가 이긴다
    const rankActive2 = new Map([
      ["page-1", 0],
      ["page-2", 1],
    ]);
    expect(
      pickTopmostHitElementId(
        [deepOnPage1.id, shallowOnPage2.id],
        elementsMap,
        null,
        rankActive2,
      ),
    ).toBe(shallowOnPage2.id);

    // page-1 이 활성이면 반대
    const rankActive1 = new Map([
      ["page-1", 1],
      ["page-2", 0],
    ]);
    expect(
      pickTopmostHitElementId(
        [deepOnPage1.id, shallowOnPage2.id],
        elementsMap,
        null,
        rankActive1,
      ),
    ).toBe(deepOnPage1.id);

    // rank 미전달 시 기존 depth 판정 유지 (더 깊은 page-1 요소)
    expect(
      pickTopmostHitElementId([deepOnPage1.id, shallowOnPage2.id], elementsMap),
    ).toBe(deepOnPage1.id);
  });

  it("같은 페이지 후보는 pagePaintRank 가 있어도 기존 체인 판정을 유지한다", () => {
    const body = makeBody({ id: "page-body", page_id: "page-1" });
    const parent = {
      id: "parent",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
      props: {},
    } as Element;
    const child = {
      id: "child",
      type: "Box",
      page_id: "page-1",
      parent_id: parent.id,
      order_num: 0,
      props: {},
    } as Element;
    const elementsMap = new Map<string, Element>([
      [body.id, body],
      [parent.id, parent],
      [child.id, child],
    ]);

    expect(
      pickTopmostHitElementId(
        [parent.id, child.id],
        elementsMap,
        null,
        new Map([["page-1", 0]]),
      ),
    ).toBe(child.id);
  });

  it("위 페이지 body 에 가려진 아래 페이지 요소는 유일 후보여도 히트 제외 (occlusion)", () => {
    // 2026-08-11 live 실측: 활성 페이지에 요소가 없는 겹침 지점에서 아래 페이지
    // 요소가 유일 후보로 남아 "안 보이는데 클릭되는" 비대칭 — occludingPageRank 로 차단
    const body3 = makeBody({ id: "page-body-3", page_id: "page-3" });
    const hiddenAlert = {
      id: "hidden-alert",
      type: "InlineAlert",
      page_id: "page-3",
      parent_id: body3.id,
      order_num: 0,
      props: {},
    } as Element;
    const elementsMap = new Map<string, Element>([
      [body3.id, body3],
      [hiddenAlert.id, hiddenAlert],
    ]);
    // page-2 활성(rank 1) 이 지점을 덮음 — page-3(rank 0) 요소는 제외
    const rank = new Map([
      ["page-2", 1],
      ["page-3", 0],
    ]);

    expect(
      pickTopmostHitElementId([hiddenAlert.id], elementsMap, null, rank, 1),
    ).toBe(null);

    // page-3 자신이 최상단이면 정상 히트
    expect(
      pickTopmostHitElementId([hiddenAlert.id], elementsMap, null, rank, 0),
    ).toBe(hiddenAlert.id);
  });

  it("uses z-index before canonical child order for overlapping siblings", () => {
    const body = makeBody({ id: "page-body", page_id: "page-1" });
    const later = {
      id: "later",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 1,
      props: { style: { zIndex: 1 } },
    } as Element;
    const elevated = {
      id: "elevated",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
      props: { style: { zIndex: 5 } },
    } as Element;
    const elementsMap = new Map<string, Element>([
      [body.id, body],
      [elevated.id, elevated],
      [later.id, later],
    ]);

    expect(
      pickTopmostHitElementId(
        [later.id, elevated.id],
        elementsMap,
        new Map([[body.id, [elevated, later]]]),
      ),
    ).toBe(elevated.id);
  });
});
