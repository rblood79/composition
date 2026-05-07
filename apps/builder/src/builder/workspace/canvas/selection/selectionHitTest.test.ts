import { describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { Element } from "../../../../types/core/store.types";
import {
  findBodySelectionAtCanvasPoint,
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
