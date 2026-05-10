import { describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { resolveCanonicalRefElementsMap } from "../../../utils/canonicalRefResolution";
import type { RendererSelectionInvalidation } from "../renderers";
import { buildSelectionRenderData } from "./skiaWorkflowSelection";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> & { frameId?: string | null } = {},
): CanvasSceneNode {
  const { frameId, ...elementOverrides } = overrides;
  const element = {
    id,
    type: "Button",
    page_id: "page-1",
    parent_id: "body-1",
    order_num: 1,
    props: {},
    ...elementOverrides,
  } as CanvasSceneNode;

  return frameId === undefined
    ? element
    : withFrameElementMirrorId(element, frameId);
}

function makeSelection(
  selectedElementIds: string[],
): RendererSelectionInvalidation {
  return {
    currentPageId: "page-1",
    editingContextId: null,
    editingSignature: "editing",
    selectedElementId: selectedElementIds[0] ?? null,
    selectedElementIds,
    selectionSignature: selectedElementIds.join("|"),
  };
}

describe("buildSelectionRenderData editing semantics", () => {
  it("single selected reusable element exposes origin semantic role", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["origin", { x: 10, y: 20, width: 100, height: 40 }]]),
      makeSelection(["origin"]),
      new Map([["origin", makeElement("origin", { reusable: true })]]),
    );

    expect(result.semanticRole).toBe("origin");
    expect(result.slotMarkerRole).toBeNull();
    expect(result.bounds).toEqual({ x: 10, y: 20, width: 100, height: 40 });
    expect(result.showHandles).toBe(true);
  });

  it("single selected ref element exposes instance semantic role", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["instance", { x: 0, y: 0, width: 80, height: 32 }]]),
      makeSelection(["instance"]),
      new Map([["instance", makeElement("instance", { type: "ref" })]]),
    );

    expect(result.semanticRole).toBe("instance");
    expect(result.slotMarkerRole).toBeNull();
  });

  it("keeps instance semantic role after canonical ref projection", () => {
    const origin = makeElement("origin", {
      type: "NumberField",
      reusable: true,
      parent_id: null,
      props: { label: "Amount" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { style: { left: "120px" } },
    } as never);
    const resolvedMap = resolveCanonicalRefElementsMap(
      new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    );

    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["instance", { x: 0, y: 0, width: 80, height: 32 }]]),
      makeSelection(["instance"]),
      resolvedMap,
    );

    expect(resolvedMap.get("instance")).toMatchObject({
      id: "instance",
      type: "NumberField",
      ref: "origin",
    });
    expect(result.semanticRole).toBe("instance");
    expect(result.slotMarkerRole).toBeNull();
  });

  it("single selected slot under an origin exposes origin slot marker role", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["origin/footer", { x: 0, y: 0, width: 120, height: 48 }]]),
      makeSelection(["origin/footer"]),
      new Map([
        [
          "origin",
          makeElement("origin", {
            parent_id: null,
            reusable: true,
            type: "frame",
          }),
        ],
        [
          "origin/footer",
          makeElement("origin/footer", {
            parent_id: "origin",
            slot: ["text"],
            type: "CardFooter",
          }),
        ],
      ]),
    );

    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBe("origin");
  });

  it("single selected slot under an instance exposes instance slot marker role", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["instance/footer", { x: 0, y: 0, width: 120, height: 48 }]]),
      makeSelection(["instance/footer"]),
      new Map([
        ["instance", makeElement("instance", { type: "ref", ref: "origin" })],
        [
          "instance/footer",
          makeElement("instance/footer", {
            parent_id: "instance",
            slot: ["text"],
            type: "CardFooter",
          }),
        ],
      ]),
    );

    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBe("instance");
  });

  it("single selected mirror Slot without component ancestry falls back to origin slot marker", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["slot-header", { x: 0, y: 0, width: 120, height: 48 }]]),
      makeSelection(["slot-header"]),
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

    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBe("origin");
  });

  it("renders selection for a page-applied frame Slot projection", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([
        ["frame-content-slot", { x: 24, y: 96, width: 320, height: 240 }],
      ]),
      makeSelection(["frame-content-slot"]),
      new Map([
        [
          "frame-content-slot",
          makeElement("frame-content-slot", {
            frameId: "frame-layout-1",
            page_id: "page-1",
            parent_id: "page-body",
            props: {
              _slotChrome: "hidden",
              _slotMarkerChrome: "visible",
              name: "content",
            },
            type: "Slot",
          }),
        ],
      ]),
    );

    expect(result.bounds).toEqual({ x: 24, y: 96, width: 320, height: 240 });
    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBe("origin");
    expect(result.showHandles).toBe(true);
  });

  it("renders selection for a layout-owned frame body while the store current page is retained", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([["frame-body", { x: 16, y: 24, width: 800, height: 600 }]]),
      makeSelection(["frame-body"]),
      new Map([
        [
          "frame-body",
          makeElement("frame-body", {
            frameId: "frame-layout-1",
            page_id: null,
            parent_id: null,
            type: "body",
          }),
        ],
      ]),
    );

    expect(result.bounds).toEqual({ x: 16, y: 24, width: 800, height: 600 });
    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBeNull();
    expect(result.showHandles).toBe(true);
  });

  it("does not render non-page Slot layout selection without current page bounds", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map(),
      makeSelection(["frame-content-slot"]),
      new Map([
        [
          "frame-content-slot",
          makeElement("frame-content-slot", {
            frameId: "frame-layout-1",
            page_id: null,
            parent_id: "frame-body",
            props: { name: "content" },
            type: "Slot",
          }),
        ],
      ]),
    );

    expect(result.bounds).toBeNull();
    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBeNull();
  });

  it("multi-selection keeps per-item semantic highlight targets", () => {
    const result = buildSelectionRenderData(
      0,
      0,
      1,
      new Map([
        ["origin", { x: 0, y: 0, width: 80, height: 32 }],
        ["plain", { x: 100, y: 0, width: 80, height: 32 }],
      ]),
      makeSelection(["origin", "plain"]),
      new Map([
        ["origin", makeElement("origin", { reusable: true })],
        ["plain", makeElement("plain")],
      ]),
    );

    expect(result.semanticRole).toBeNull();
    expect(result.slotMarkerRole).toBeNull();
    expect(result.semanticTargets).toEqual([
      {
        bounds: { x: 0, y: 0, width: 80, height: 32 },
        semanticRole: "origin",
        slotMarkerRole: null,
      },
    ]);
    expect(result.showHandles).toBe(false);
  });
});
