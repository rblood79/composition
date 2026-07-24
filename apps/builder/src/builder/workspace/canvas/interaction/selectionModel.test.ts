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

  it("keeps element selection bounds in scene coordinates (pan/zoom 무보정)", () => {
    // getBounds(=getElementBoundsSimple) 는 이미 **scene 좌표**를 반환하고,
    // 히트 판정 상대인 canvasPos 도 screenToCanvasPoint 결과라 scene 좌표다.
    // 여기서 panOffset 을 빼거나 zoom 으로 나누면 선택 박스가 유령 위치로 이동해
    // 엉뚱한 좌표의 클릭이 inSelectionBounds 로 먹힌다 (2026-07-24 실측:
    // scene 20,104 350x84 → -195,-124 로 panOffset(215,228) 만큼 이탈).
    const element = {
      id: "listbox-item",
      type: "ListBoxItem",
      page_id: "page-1",
      parent_id: "body-1",
      order_num: 0,
      props: {},
    } as unknown as Element;

    expect(
      computeSelectionBounds({
        getBounds: () => ({ x: 20, y: 104, width: 350, height: 84 }),
        pageHeight: 844,
        pageWidth: 390,
        selectedElements: [element],
        zoom: 1,
      }),
    ).toEqual({ x: 20, y: 104, width: 350, height: 84 });
  });

  it("does not rescale element selection bounds by zoom", () => {
    const element = {
      id: "card",
      type: "Card",
      page_id: "page-1",
      parent_id: "body-1",
      order_num: 0,
      props: {},
    } as unknown as Element;

    // zoom 은 화면 표시 배율일 뿐, scene 박스 크기는 변하지 않는다.
    expect(
      computeSelectionBounds({
        getBounds: () => ({ x: 40, y: 60, width: 200, height: 120 }),
        pageHeight: 844,
        pageWidth: 390,
        selectedElements: [element],
        zoom: 0.5,
      }),
    ).toEqual({ x: 40, y: 60, width: 200, height: 120 });
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
