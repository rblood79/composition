import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import {
  buildFrameTitleRenderItems,
  buildHoverHighlightTargets,
  buildSlotMarkerTargets,
} from "./skiaOverlayHelpers";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Button",
    page_id: "page-1",
    parent_id: "body-1",
    order_num: 1,
    props: {},
    ...overrides,
  } as CanvasSceneNode;
}

describe("buildHoverHighlightTargets editing semantics", () => {
  it("marks origin and instance hover targets with semantic roles", () => {
    const targets = buildHoverHighlightTargets(
      new Map([
        ["origin", { x: 0, y: 0, width: 100, height: 40 }],
        ["instance", { x: 120, y: 0, width: 100, height: 40 }],
      ]),
      "origin",
      ["instance"],
      true,
      new Map([
        ["origin", makeElement("origin", { reusable: true })],
        ["instance", makeElement("instance", { type: "ref", ref: "origin" })],
      ]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        dashed: false,
        semanticRole: "origin",
        slotMarkerRole: null,
      }),
      expect.objectContaining({
        dashed: true,
        semanticRole: "instance",
        slotMarkerRole: null,
      }),
    ]);
  });

  it("keeps default hover role for plain elements", () => {
    const targets = buildHoverHighlightTargets(
      new Map([["plain", { x: 0, y: 0, width: 100, height: 40 }]]),
      "plain",
      [],
      false,
      new Map([["plain", makeElement("plain")]]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        dashed: false,
        semanticRole: null,
        slotMarkerRole: null,
      }),
    ]);
  });

  it("uses visible page frame bounds for page body hover when tree bounds are absent", () => {
    const targets = buildHoverHighlightTargets(
      new Map(),
      "page-body",
      [],
      false,
      new Map([
        [
          "page-body",
          makeElement("page-body", { page_id: "page-1", type: "body" }),
        ],
      ]),
      [
        {
          id: "page-1",
          title: "Home",
          x: 10,
          y: 20,
          width: 320,
          height: 200,
          elementCount: 0,
        },
      ],
    );

    expect(targets).toEqual([
      expect.objectContaining({
        bounds: { x: 10, y: 20, width: 320, height: 200 },
        dashed: false,
        semanticRole: null,
        slotMarkerRole: null,
      }),
    ]);
  });

  it("marks slot hover targets with origin and instance slot roles", () => {
    const origin = makeElement("origin", {
      parent_id: null,
      reusable: true,
      type: "frame",
    });
    const originSlot = makeElement("origin/footer", {
      parent_id: "origin",
      slot: ["text"],
      type: "CardFooter",
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
    });
    const instanceSlot = makeElement("instance/footer", {
      parent_id: "instance",
      slot: ["text"],
      type: "CardFooter",
    });

    const targets = buildHoverHighlightTargets(
      new Map([
        ["origin/footer", { x: 0, y: 0, width: 100, height: 40 }],
        ["instance/footer", { x: 120, y: 0, width: 100, height: 40 }],
      ]),
      "origin/footer",
      ["instance/footer"],
      true,
      new Map([
        ["origin", origin],
        ["origin/footer", originSlot],
        ["instance", instance],
        ["instance/footer", instanceSlot],
      ]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        semanticRole: null,
        slotMarkerRole: "origin",
      }),
      expect.objectContaining({
        semanticRole: null,
        slotMarkerRole: "instance",
      }),
    ]);
  });

  it("marks visible legacy Slot hover targets as origin slot authoring chrome", () => {
    const targets = buildHoverHighlightTargets(
      new Map([["slot-header", { x: 0, y: 0, width: 100, height: 40 }]]),
      "slot-header",
      [],
      false,
      new Map([
        [
          "slot-header",
          makeElement("slot-header", {
            parent_id: "frame-body",
            props: { name: "header" },
            type: "Slot",
          }),
        ],
      ]),
    );

    expect(targets).toEqual([
      expect.objectContaining({
        semanticRole: null,
        slotMarkerRole: "origin",
      }),
    ]);
  });
});

describe("buildSlotMarkerTargets", () => {
  it("collects visible slot authoring bounds, hatching only empty slots and keeping filled slot borders", () => {
    const targets = buildSlotMarkerTargets(
      new Map([
        ["slot-header", { x: 0, y: 0, width: 100, height: 40 }],
        ["slot-filled", { x: 0, y: 60, width: 100, height: 40 }],
        ["slot-with-deleted-child", { x: 0, y: 120, width: 100, height: 40 }],
        ["card-footer", { x: 0, y: 180, width: 100, height: 40 }],
        ["card-content-filled", { x: 0, y: 240, width: 100, height: 40 }],
        ["page-slot-filled", { x: 0, y: 300, width: 100, height: 40 }],
        ["slot-hidden", { x: 0, y: 360, width: 100, height: 40 }],
        ["page-slot-hidden-visible", { x: 0, y: 420, width: 100, height: 40 }],
        [
          "page-slot-hidden-visible-filled",
          { x: 0, y: 480, width: 100, height: 40 },
        ],
        ["plain", { x: 0, y: 540, width: 100, height: 40 }],
      ]),
      new Map([
        [
          "slot-header",
          makeElement("slot-header", {
            props: { name: "header" },
            type: "Slot",
          }),
        ],
        [
          "slot-filled",
          makeElement("slot-filled", {
            props: { name: "content" },
            type: "Slot",
          }),
        ],
        [
          "slot-filled-child",
          makeElement("slot-filled-child", {
            parent_id: "slot-filled",
            type: "Text",
          }),
        ],
        [
          "slot-with-deleted-child",
          makeElement("slot-with-deleted-child", {
            props: { name: "sidebar" },
            type: "Slot",
          }),
        ],
        [
          "deleted-slot-child",
          makeElement("deleted-slot-child", {
            deleted: true,
            parent_id: "slot-with-deleted-child",
            type: "Text",
          }),
        ],
        [
          "card-footer",
          makeElement("card-footer", {
            slot: ["recommended-text"],
            type: "CardFooter",
          }),
        ],
        [
          "card-content-filled",
          makeElement("card-content-filled", {
            slot: ["recommended-text"],
            type: "CardContent",
          }),
        ],
        [
          "card-content-child",
          makeElement("card-content-child", {
            parent_id: "card-content-filled",
            type: "Text",
          }),
        ],
        [
          "page-slot-filled",
          makeElement("page-slot-filled", {
            props: { name: "content" },
            type: "Slot",
          }),
        ],
        [
          "page-content",
          makeElement("page-content", {
            parent_id: "page-body",
            type: "Text",
          }),
        ],
        [
          "slot-hidden",
          makeElement("slot-hidden", {
            props: { _slotChrome: "hidden", name: "content" },
            type: "Slot",
          }),
        ],
        [
          "page-slot-hidden-visible",
          makeElement("page-slot-hidden-visible", {
            props: {
              _slotChrome: "hidden",
              _slotMarkerChrome: "visible",
              name: "content",
            },
            type: "Slot",
          }),
        ],
        [
          "page-slot-hidden-visible-filled",
          makeElement("page-slot-hidden-visible-filled", {
            props: {
              _slotChrome: "hidden",
              _slotMarkerChrome: "visible",
              name: "content",
            },
            type: "Slot",
          }),
        ],
        [
          "page-slot-hidden-visible-child",
          makeElement("page-slot-hidden-visible-child", {
            parent_id: "page-slot-hidden-visible-filled",
            type: "Text",
          }),
        ],
        ["plain", makeElement("plain")],
      ]),
      new Map([
        [
          "page-slot-filled",
          [
            makeElement("page-content", {
              parent_id: "page-body",
              type: "Text",
            }),
          ],
        ],
        [
          "page-slot-hidden-visible-filled",
          [
            makeElement("page-slot-hidden-visible-child", {
              parent_id: "page-slot-hidden-visible-filled",
              type: "Text",
            }),
          ],
        ],
      ]),
    );

    expect(targets).toEqual([
      {
        bounds: { x: 0, y: 0, width: 100, height: 40 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 60, width: 100, height: 40 },
        showHatch: false,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 120, width: 100, height: 40 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 180, width: 100, height: 40 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 240, width: 100, height: 40 },
        showHatch: false,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 300, width: 100, height: 40 },
        showHatch: false,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 420, width: 100, height: 40 },
        showHatch: true,
        slotMarkerRole: "origin",
      },
      {
        bounds: { x: 0, y: 480, width: 100, height: 40 },
        showHatch: false,
        slotMarkerRole: "origin",
      },
    ]);
  });
});

describe("buildFrameTitleRenderItems", () => {
  it("builds Pencil-style frame labels from multi-frame areas", () => {
    const items = buildFrameTitleRenderItems(
      [
        {
          frameId: "frame-a",
          frameName: "Checkout",
          x: 100,
          y: 200,
          width: 1440,
          height: 900,
        },
        {
          frameId: "frame-b",
          frameName: "Settings",
          x: 1600,
          y: 200,
          width: 1440,
          height: 900,
        },
      ],
      "frame-b",
    );

    expect(items).toEqual([
      {
        frameId: "frame-a",
        title: "Checkout",
        x: 100,
        y: 200,
        highlighted: false,
      },
      {
        frameId: "frame-b",
        title: "Settings",
        x: 1600,
        y: 200,
        highlighted: true,
      },
    ]);
  });
});
