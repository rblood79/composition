import { describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { Element } from "../../../../types/core/store.types";
import {
  computeSelectionBounds,
  resolveSelectedElementsForPage,
} from "./selectionModel";

function makeBody(id: string, frameId: string): Element {
  return withFrameElementMirrorId(
    {
      id,
      type: "body",
      page_id: null,
      parent_id: null,
      order_num: 0,
      props: {},
    } as Element,
    frameId,
  );
}

describe("selectionModel frame body selection", () => {
  it("keeps canonical frame bodies selectable even without a page_id", () => {
    const body = makeBody("frame-body", "frame-1");

    const selectedElements = resolveSelectedElementsForPage({
      currentPageId: "page-1",
      elementsMap: new Map([[body.id, body]]),
      selectedElementIds: [body.id],
    });

    expect(selectedElements).toEqual([body]);
  });

  it("uses the frame area as the selection bounds for a frame body", () => {
    const body = makeBody("frame-body", "frame-1");

    expect(
      computeSelectionBounds({
        frameAreas: [
          { frameId: "frame-1", x: 120, y: 80, width: 640, height: 480 },
        ],
        pageHeight: 600,
        pageWidth: 800,
        selectedElements: [body],
      }),
    ).toEqual({ x: 120, y: 80, width: 640, height: 480 });
  });
});
